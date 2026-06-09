/** Audio + haptic feedback for mic vs tab connect. */

export const hapticConnect = (mode) => {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  if (mode === 'mic') navigator.vibrate([12, 40, 18]);
  else navigator.vibrate([8, 24, 8, 24, 28]);
};

export const flashConnectMode = (mode) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-connect-flash', mode);
  window.setTimeout(() => root.removeAttribute('data-connect-flash'), 700);
};
