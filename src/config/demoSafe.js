/**
 * Demo Safe Mode — hides broken/peripheral UI for recorded walkthroughs.
 *
 * Enable via any of:
 *   REACT_APP_DEMO_SAFE_MODE=true   (build-time)
 *   ?demo=1 on the URL              (runtime, no rebuild)
 *   localStorage catint_demo_safe=1 (runtime toggle)
 */
const ENV_FLAG = process.env.REACT_APP_DEMO_SAFE_MODE === 'true';

export const isDemoSafeMode = () => {
  if (ENV_FLAG) return true;
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1' || params.get('demo_safe') === '1') return true;
    return localStorage.getItem('catint_demo_safe') === '1';
  } catch {
    return false;
  }
};

/** Persist runtime toggle (e.g. from devtools or a future settings chip). */
export const setDemoSafeMode = (on) => {
  try {
    if (on) localStorage.setItem('catint_demo_safe', '1');
    else localStorage.removeItem('catint_demo_safe');
  } catch {}
};
