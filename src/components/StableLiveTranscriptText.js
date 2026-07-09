import React, { useMemo, useRef } from 'react';
import {
  applyDisplayProtections,
  copyableDigits,
  NUMBER_HIGHLIGHT_REGEX,
} from '../utils/sensitiveDataProtector';
import { formatTranscriptForDisplay } from '../utils/transcriptFormat';
import {
  advanceCommittedPrefix,
  tokenizeDisplay,
} from '../utils/stableLiveTranscript';

const processDisplayText = (raw, lang, applyNumberWords, protectionsActive) => {
  const spelled = formatTranscriptForDisplay(raw, lang);
  if (!protectionsActive) return spelled;
  return applyDisplayProtections(spelled, lang, { applyNumberWords });
};

const splitSegments = (segment) => {
  if (!segment) return [];
  return segment.split(NUMBER_HIGHLIGHT_REGEX);
};

/**
 * Single live STT source render path — no ScrambleText, no path switching.
 * Committed prefix stays fixed; only uncertain tail updates.
 */
export function StableLiveTranscriptText({
  text = '',
  lang = 'en',
  applyNumberWords = false,
  protectionsActive = true,
  continuityKey = '',
}) {
  const committedRef = useRef('');
  const continuityRef = useRef(continuityKey);

  if (continuityRef.current !== continuityKey) {
    continuityRef.current = continuityKey;
    committedRef.current = '';
  }

  const repaired = useMemo(
    () => (text ? processDisplayText(text, lang, applyNumberWords, protectionsActive) : ''),
    [text, lang, applyNumberWords, protectionsActive],
  );

  // Ref ratchet during render (allowed) — keeps committed across interim updates.
  const { committed, tail } = advanceCommittedPrefix(committedRef.current, repaired);
  committedRef.current = committed;

  const handleCopy = (num) => {
    const clean = copyableDigits(num);
    if (!clean) return;
    try {
      navigator.clipboard.writeText(clean);
    } catch (_) {}
  };

  const renderPlain = (segment, keyPrefix) => {
    if (!segment) return null;
    const tokens = tokenizeDisplay(segment);
    const chunks = tokens.length ? tokens : [segment];
    return chunks.map((tok, i) => {
      const parts = splitSegments(tok);
      return (
        <span key={`${keyPrefix}${i}`}>
          {parts.map((p, j) => {
            if (p && p.match(NUMBER_HIGHLIGHT_REGEX)) {
              return (
                <span
                  key={`${keyPrefix}${i}n${j}`}
                  className="phone-number highlight-number"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(p);
                  }}
                  title={`Click to copy: ${copyableDigits(p)}`}
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
                  {p}
                </span>
              );
            }
            return <span key={`${keyPrefix}${i}t${j}`}>{p}</span>;
          })}
        </span>
      );
    });
  };

  if (!repaired) return null;

  return (
    <span className="stable-live-transcript">
      <span className="stable-live-committed">{renderPlain(committed, 'c-')}</span>
      {tail ? (
        <span className="stable-live-tail">{renderPlain(tail, 't-')}</span>
      ) : null}
    </span>
  );
}

export default StableLiveTranscriptText;
