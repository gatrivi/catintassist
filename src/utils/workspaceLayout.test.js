import {
  loadPaneOrder,
  savePaneOrder,
  PANE_INTERPRET_TOP,
  PANE_SCOREBOARD_TOP,
  PANE_ORDER_KEY,
} from './workspaceLayout';

describe('workspaceLayout', () => {
  beforeEach(() => {
    localStorage.removeItem(PANE_ORDER_KEY);
  });

  test('defaults to interpret on top', () => {
    expect(loadPaneOrder()).toBe(PANE_INTERPRET_TOP);
  });

  test('savePaneOrder persists scoreboard-top', () => {
    savePaneOrder(PANE_SCOREBOARD_TOP);
    expect(loadPaneOrder()).toBe(PANE_SCOREBOARD_TOP);
  });
});
