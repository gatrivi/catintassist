import React from 'react';
import { StableTextMorph } from './StableTextMorph';

/**
 * Live STT source path (v4.84.1) — continuity-preserving morph, not plain snap,
 * not ScrambleText. Delegates to StableTextMorph.
 *
 * v4.140.0: forwards the word scores so the morph can tell a higher-confidence
 * rewrite (supersede: dim the old wording, frame the new) from a plain
 * continuation or an unimproved rewrite (quiet adopt).
 */
export function StableLiveTranscriptText({
  text = '',
  lang = 'en',
  applyNumberWords = false,
  protectionsActive = true,
  continuityKey = '',
  wordConfidence = null,
  supersedeHoldMs,
  supersedeRetireMs,
}) {
  return (
    <StableTextMorph
      text={text}
      lang={lang}
      applyNumberWords={applyNumberWords}
      protectionsActive={protectionsActive}
      continuityKey={continuityKey}
      wordConfidence={wordConfidence}
      supersedeHoldMs={supersedeHoldMs}
      supersedeRetireMs={supersedeRetireMs}
    />
  );
}

export default StableLiveTranscriptText;
