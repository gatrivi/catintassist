/** Mic mode (phone / no tab share) — persisted in localStorage. v4.80.15 */

export const MIC_TEST_STORAGE_KEY = 'catint_mic_test_mode_v1';

export const readMicTestMode = () => {
  try {
    return localStorage.getItem(MIC_TEST_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export const writeMicTestMode = (on) => {
  try {
    localStorage.setItem(MIC_TEST_STORAGE_KEY, on ? '1' : '0');
  } catch (_) {}
};
