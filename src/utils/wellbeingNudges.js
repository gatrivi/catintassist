/** Escalating wellbeing nudge levels when user ignores reminders. */
const PREFIX = 'catint_wellbeing_nudge_';

export const getNudgeLevel = (widgetId) => {
  try {
    return parseInt(localStorage.getItem(`${PREFIX}${widgetId}`) || '0', 10) || 0;
  } catch {
    return 0;
  }
};

export const recordNudgeShown = (widgetId) => {
  try {
    const next = getNudgeLevel(widgetId) + 1;
    localStorage.setItem(`${PREFIX}${widgetId}`, String(next));
    window.dispatchEvent(new CustomEvent('cat_wellbeing_nudge_changed', { detail: { widgetId, level: next } }));
    return next;
  } catch {
    return 0;
  }
};

export const acknowledgeNudge = (widgetId) => {
  try {
    localStorage.setItem(`${PREFIX}${widgetId}`, '0');
    window.dispatchEvent(new CustomEvent('cat_wellbeing_nudge_changed', { detail: { widgetId, level: 0 } }));
  } catch {
    /* ignore */
  }
};

/** Toast duration ms and copy prefix by ignore level. */
export const getNudgePresentation = (widgetId, baseMessage) => {
  const level = getNudgeLevel(widgetId);
  if (level >= 3) {
    return {
      level,
      persistent: true,
      message: `${baseMessage} — your body needs this.`,
      durationMs: 0,
    };
  }
  if (level === 2) {
    return { level, persistent: false, message: `Still waiting: ${baseMessage}`, durationMs: 8000 };
  }
  if (level === 1) {
    return { level, persistent: false, message: baseMessage, durationMs: 5000 };
  }
  return { level: 0, persistent: false, message: baseMessage, durationMs: 3000 };
};

export const hasPersistentWellbeingAlert = () => {
  const ids = ['desk', 'rosary', 'meals', 'chores'];
  return ids.some((id) => getNudgeLevel(id) >= 3);
};
