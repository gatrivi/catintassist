import React from 'react';
import { StableTextMorph } from './StableTextMorph';

/**
 * Live STT source path (v4.84.1) — continuity-preserving morph, not plain snap,
 * not ScrambleText. Delegates to StableTextMorph.
 */
export function StableLiveTranscriptText({
  text = '',
  lang = 'en',
  applyNumberWords = false,
  protectionsActive = true,
  continuityKey = '',
}) {
  return (
    <StableTextMorph
      text={text}
      lang={lang}
      applyNumberWords={applyNumberWords}
      protectionsActive={protectionsActive}
      continuityKey={continuityKey}
    />
  );
}

export default StableLiveTranscriptText;
