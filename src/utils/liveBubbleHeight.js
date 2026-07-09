/**
 * Live-bubble anti-jitter height lock (v4.84.10).
 *
 * Bug fixed: on text shrink (seal-split leaves only the tail) the old code
 * re-measured WHILE minHeight was still applied, so the measured height could
 * never drop below the old lock — the tail bubble kept full-paragraph height
 * forever ("the void"). Shrink must RELEASE the lock so the node re-measures
 * at natural height on the next paint.
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

  // Measured shrink > 8px → lock down to the smaller height.
  if (prevH > 0 && height < prevH - 8) {
    return { set: { height, textLen }, rerender: true };
  }

  // Grow past anti-jitter (±2px) only.
  if (height > prevH + 2) {
    return { set: { height, textLen }, rerender: true };
  }

  // Keep textLen fresh even when height is stable.
  if (prev && textLen !== prevLen) {
    return { set: { height: prevH || height, textLen }, rerender: false };
  }

  return null;
}
