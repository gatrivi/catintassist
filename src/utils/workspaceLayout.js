export const PANE_ORDER_KEY = 'catint_pane_order_v1';
export const PANE_INTERPRET_TOP = 'interpret-top';
export const PANE_SCOREBOARD_TOP = 'scoreboard-top';

export const loadPaneOrder = () => {
  try {
    const v = localStorage.getItem(PANE_ORDER_KEY);
    if (v === PANE_SCOREBOARD_TOP) return PANE_SCOREBOARD_TOP;
  } catch (_) {}
  return PANE_INTERPRET_TOP;
};

export const savePaneOrder = (order) => {
  const next = order === PANE_SCOREBOARD_TOP ? PANE_SCOREBOARD_TOP : PANE_INTERPRET_TOP;
  try {
    localStorage.setItem(PANE_ORDER_KEY, next);
  } catch (_) {}
  try {
    window.dispatchEvent(new CustomEvent('cat_pane_order_changed', { detail: next }));
  } catch (_) {}
  return next;
};
