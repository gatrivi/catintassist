import React, { useEffect, useMemo, useRef, useState } from 'react';
import { prefersReducedMotion } from '../utils/motionPreference';
import {
  applyDisplayProtections,
  copyableDigits,
  copyableSensitiveValue,
  splitHighlightSegments,
} from '../utils/sensitiveDataProtector';
import { formatTranscriptForDisplay } from '../utils/transcriptFormat';
import {
  diffWordsStable,
  isProtectedToken,
} from '../utils/diffWordsStable';
import { flagVanish } from '../utils/vanishTrace';

const CUE_MS = 480;
const REDUCED_CUE_MS = 120;

const processDisplayText = (raw, lang, applyNumberWords, protectionsActive) => {
  const spelled = formatTranscriptForDisplay(raw, lang);
  if (!protectionsActive) return spelled;
  return applyDisplayProtections(spelled, lang, { applyNumberWords });
};

const SensitiveSpan = ({ value, type = 'number' }) => {
  const copyVal = (type === 'date' || type === 'dosage' || type === 'money')
    ? copyableSensitiveValue(value, type)
    : copyableDigits(value);
  const kindClass = type === 'number' ? 'phone-number' : `${type}-unit`;
  return (
    <span
      className={`${kindClass} highlight-number`}
      onClick={(e) => {
        e.stopPropagation();
        if (copyVal) {
          try {
            navigator.clipboard.writeText(copyVal);
          } catch (_) {}
        }
      }}
      title={`Click to copy: ${copyVal}`}
      style={{
        cursor: 'copy',
        backgroundColor: 'rgba(252, 211, 77, 0.1)',
        color: '#fcd34d',
        padding: '0 2px',
        borderRadius: '2px',
        fontWeight: 600,
        display: 'inline',
      }}
    >
      {value}
    </span>
  );
};

const renderTokenText = (text) => {
  if (!text) return null;
  return splitHighlightSegments(text).map((seg, i) => {
    if (seg.type === 'date' || seg.type === 'number' || seg.type === 'dosage' || seg.type === 'money') {
      return <SensitiveSpan key={`${seg.type}${i}`} value={seg.value} type={seg.type} />;
    }
    return <span key={`t${i}`}>{seg.value}</span>;
  });
};

/**
 * Continuity-preserving live transcript morph (v4.84.1).
 * Same parent stays mounted; word diff cues changes; never blank between A and B.
 * Not ScrambleText — critical reading continuity.
 */
export function StableTextMorph({
  text = '',
  lang = 'en',
  applyNumberWords = false,
  protectionsActive = true,
  continuityKey = '',
  cueMs = CUE_MS,
}) {
  const continuityRef = useRef(continuityKey);
  const prevDisplayRef = useRef('');
  const [cueOps, setCueOps] = useState(null);
  const [reducedCue, setReducedCue] = useState(false);
  const cueTimerRef = useRef(null);

  const display = useMemo(
    () => (text ? processDisplayText(text, lang, applyNumberWords, protectionsActive) : ''),
    [text, lang, applyNumberWords, protectionsActive],
  );

  if (continuityRef.current !== continuityKey) {
    if (prevDisplayRef.current) {
      flagVanish('morph_continuity_reset', {
        before: prevDisplayRef.current,
        after: display,
        remount: true,
        force: true,
        stage: 'StableTextMorph',
        extra: { fromKey: continuityRef.current, toKey: continuityKey },
      });
    }
    continuityRef.current = continuityKey;
    prevDisplayRef.current = '';
  }

  useEffect(() => {
    const prev = prevDisplayRef.current;
    if (!display) {
      if (prev) {
        flagVanish('morph_display_empty', {
          before: prev,
          after: '',
          derender: true,
          force: true,
          stage: 'StableTextMorph',
        });
      }
      prevDisplayRef.current = '';
      setCueOps(null);
      return undefined;
    }

    if (!prev || prev === display) {
      prevDisplayRef.current = display;
      setCueOps(null);
      return undefined;
    }

    const ops = diffWordsStable(prev, display);
    const lost = ops
      .filter((o) => o.type === 'delete' || o.type === 'replace')
      .map((o) => o.from || o.text)
      .filter(Boolean);
    if (lost.length) {
      flagVanish('morph_word_diff', {
        before: prev,
        after: display,
        lost,
        stage: 'StableTextMorph',
        force: true,
        extra: {
          ops: ops.filter((o) => o.type !== 'equal').map((o) => ({ type: o.type, from: o.from, text: o.text })),
        },
      });
    }
    prevDisplayRef.current = display;

    const hasChange = ops.some((o) => o.type !== 'equal');
    if (!hasChange) {
      setCueOps(null);
      return undefined;
    }

    const reduced = prefersReducedMotion();
    setReducedCue(reduced);
    setCueOps(ops);
    if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
    const ms = reduced ? REDUCED_CUE_MS : cueMs;
    cueTimerRef.current = setTimeout(() => {
      setCueOps(null);
      cueTimerRef.current = null;
    }, ms);

    return () => {
      if (cueTimerRef.current) {
        clearTimeout(cueTimerRef.current);
        cueTimerRef.current = null;
      }
    };
  }, [display, cueMs]);

  if (!display && !cueOps) return null;

  if (cueOps) {
    return (
      <span className="stable-text-morph" data-morphing="1">
        {cueOps.map((op) => {
          if (op.type === 'equal') {
            return (
              <span key={op.key} className="stm-equal">
                {renderTokenText(op.text)}
              </span>
            );
          }
          if (op.type === 'insert') {
            return (
              <span key={op.key} className="stm-insert">
                {renderTokenText(op.text)}
              </span>
            );
          }
          if (op.type === 'delete') {
            if (reducedCue && !isProtectedToken(op.text)) return null;
            const cls = isProtectedToken(op.text)
              ? 'stm-delete stm-delete--protected'
              : 'stm-delete';
            return (
              <span key={op.key} className={cls} aria-hidden>
                {renderTokenText(op.text)}
              </span>
            );
          }
          if (op.type === 'replace') {
            const protect = isProtectedToken(op.from) || isProtectedToken(op.to);
            if (reducedCue) {
              return (
                <span
                  key={op.key}
                  className={`stm-replace stm-replace--instant${protect ? ' stm-replace--protected' : ''}`}
                >
                  {renderTokenText(op.to)}
                </span>
              );
            }
            return (
              <span
                key={op.key}
                className={`stm-replace${protect ? ' stm-replace--protected' : ''}`}
              >
                <span className="stm-replace-from" aria-hidden>
                  {renderTokenText(op.from)}
                </span>
                <span className="stm-replace-arrow" aria-hidden>
                  {' ⇢ '}
                </span>
                <span className="stm-replace-to">{renderTokenText(op.to)}</span>
              </span>
            );
          }
          return null;
        })}
      </span>
    );
  }

  return (
    <span className="stable-text-morph" data-morphing="0">
      {renderTokenText(display)}
    </span>
  );
}

export default StableTextMorph;
