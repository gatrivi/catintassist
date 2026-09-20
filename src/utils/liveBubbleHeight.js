/**
 * Live-bubble anti-jitter height lock (v4.84.10, hardened v4.134.0).
 *
 * Bug fixed (v4.84.10): on text shrink (seal-split leaves only the tail) the
 * old code re-measured WHILE minHeight was still applied, so the measured
 * height could never drop below the old lock — the tail bubble kept
 * full-paragraph height forever ("the void"). Shrink must RELEASE the lock
 * so the node re-measures at natural height on the next paint.
 *
 * Hardened (v4.134.0 — bubble-overlap fix): a height that grows while the
 * text did NOT grow is transition/relayout noise, not real content — locking
 * it inflated bubble N so the next bubble mounted over unreadable space.
 * Growth locks now require the text to have grown too; a height shrink while
 * text grew is treated as noise and ignored.
 *
 * @param {{height:number,textLen:number}|undefined} prev current lock entry
 * @param {number} height measured rect height (may be inflated by active lock)
 * @param {number} textLen current text length
 * @returns {{release:true}|{set:{height:number,textLen:number},rerender:boolean}|null}
 */
export function nextLiveHeightLock(prev, height, textLen) {
  const prevH = prev?.height ?? 0;
  const prevLen = prev?.textLen ?? 0;

  // Text shorter than when lock was set → drop lock, re-measure naturally.
  if (prev && textLen > 0 && textLen < prevLen - 2) return { release: true };

  const textGrew = textLen > prevLen;

  // Height shrinks while text grows → mid-relayout measurement, ignore.
  if (prevH > 0 && height < prevH - 8 && textGrew) return null;

  // Measured shrink > 8px (text not growing) → lock down to smaller height.
  if (prevH > 0 && height < prevH - 8) {
    return { set: { height, textLen }, rerender: true };
  }

  // Grow only when the text actually grew — height growth without text
  // growth is the overlap bug (v4.134.0).
  if (height > prevH + 2 && (textGrew || !prev)) {
    return { set: { height, textLen }, rerender: true };
  }

  // Keep textLen fresh even when height is stable.
  if (prev && textLen !== prevLen) {
    return { set: { height: prevH || height, textLen }, rerender: false };
  }

  return null;
}
