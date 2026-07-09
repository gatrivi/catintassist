import React, { useEffect, useMemo, useRef, useState } from 'react';
import { prefersReducedMotion } from '../utils/motionPreference';
import {
  applyDisplayProtections,
  copyableDigits,
  NUMBER_HIGHLIGHT_REGEX,
} from '../utils/sensitiveDataProtector';
import { formatTranscriptForDisplay } from '../utils/transcriptFormat';
import {
  diffWordsStable,
  isProtectedToken,
} from '../utils/diffWordsStable';

const CUE_MS = 480;
const REDUCED_CUE_MS = 120;

const processDisplayText = (raw, lang, applyNumberWords, protectionsActive) => {
  const spelled = formatTranscriptForDisplay(raw, lang);
  if (!protectionsActive) return spelled;
  return applyDisplayProtections(spelled, lang, { applyNumberWords });
};

const PhoneSpan = ({ value }) => (
  <span
    className="phone-number highlight-number"
    onClick={(e) => {
      e.stopPropagation();
      const clean = copyableDigits(value);
      if (clean) {
        try {
          navigator.clipboard.writeText(clean);
        } catch (_) {}
      }
    }}
    title={`Click to copy: ${copyableDigits(value)}`}
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

const renderTokenText = (text) => {
  if (!text) return null;
  const parts = text.split(NUMBER_HIGHLIGHT_REGEX);
  return parts.map((p, i) => {
    if (p && p.match(NUMBER_HIGHLIGHT_REGEX)) {
      return <PhoneSpan key={`n${i}`} value={p} />;
    }
    return <span key={`t${i}`}>{p}</span>;
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
    continuityRef.current = continuityKey;
    prevDisplayRef.current = '';
  }

  useEffect(() => {
    const prev = prevDisplayRef.current;
    if (!display) {
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
