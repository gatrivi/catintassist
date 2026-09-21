import React, { useMemo } from 'react';
import { findRepeatedWordRuns, splitTextByRuns } from '../utils/repeatedWordRuns';

/**
 * Readability net (v4.142.0) — DISPLAY-ONLY repeat dimming.
 *
 * Wraps the LATER occurrences of a >4-word run that already appeared earlier in
 * `text` in `<span className="repeat-dim">` (opacity 0.72 — see
 * `src/index.css`; the floor is pinned by `repeatedWordRuns.test.js`).
 *
 * Nothing else changes: the chunks handed to `renderChunk` concatenate back to
 * `text` byte for byte, so the rendered textContent is exactly what the pane
 * showed before this net existed. Words are never removed, hidden or reordered,
 * digits/doses/phones stay fully present (dimmed text is still ≥70% visible).
 *
 * `renderChunk(chunkText, part)` lets each call site keep its own token
 * rendering (sensitive-data chips, number highlighting, confidence tints);
 * `part.wordOffset` keeps word-indexed renderers aligned after the split.
 * Split points are at whitespace between words, so no token is ever cut.
 */
export function RepeatDimText({ text = '', minWords, renderChunk }) {
  const parts = useMemo(
    () => splitTextByRuns(text, findRepeatedWordRuns(text, { minWords })),
    [text, minWords],
  );

  if (!parts.length) return null;
  return (
    <>
      {parts.map((part, index) => {
        const node = renderChunk(part.text, { ...part, index });
        if (!node) return null;
        if (!part.dim) return <React.Fragment key={`rd${index}`}>{node}</React.Fragment>;
        return (
          <span key={`rd${index}`} className="repeat-dim" data-repeat-dim="1">
            {node}
          </span>
        );
      })}
    </>
  );
}

export default RepeatDimText;
