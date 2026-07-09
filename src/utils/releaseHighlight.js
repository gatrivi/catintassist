/** Temporary shine on DOM elements referenced in release notes. */

export const RELEASE_HIGHLIGHT_CLASS = 'catint-ui-shine';
export const RELEASE_HIGHLIGHT_EVENT = 'catint_release_highlight';

let clearTimer = null;

export const applyReleaseHighlights = (elementIds = [], durationMs = 45000) => {
  if (typeof document === 'undefined') return () => {};

  const ids = Array.isArray(elementIds) ? elementIds.filter(Boolean) : [];
  const elements = ids
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  elements.forEach((el) => el.classList.add(RELEASE_HIGHLIGHT_CLASS));

  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    clearReleaseHighlights(ids);
    clearTimer = null;
  }, durationMs);

  try {
    window.dispatchEvent(
      new CustomEvent(RELEASE_HIGHLIGHT_EVENT, { detail: { elementIds: ids, durationMs } }),
    );
  } catch (_) {}

  return () => clearReleaseHighlights(ids);
};

export const clearReleaseHighlights = (elementIds = []) => {
  if (typeof document === 'undefined') return;
  const ids = Array.isArray(elementIds) ? elementIds : [];
  ids.forEach((id) => {
    document.getElementById(id)?.classList.remove(RELEASE_HIGHLIGHT_CLASS);
  });
  if (!ids.length) {
    document.querySelectorAll(`.${RELEASE_HIGHLIGHT_CLASS}`).forEach((el) => {
      el.classList.remove(RELEASE_HIGHLIGHT_CLASS);
    });
  }
};
