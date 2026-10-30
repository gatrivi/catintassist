/**
 * Caption Engine v2 — Phase B: Shadow Mode (v4.201.0).
 *
 * Runs v2 beside v1 in the background without touching the UI.
 * Compares final words between v1 (captionEngine) and v2 (sttLedger)
 * to prove in live production whether v2 loss = 0.
 *
 * Switch ships OFF by default.
 */

export const LEDGER_SHADOW_KEY = 'catint_stt_ledger_shadow';

export const readLedgerShadowSwitch = () => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(LEDGER_SHADOW_KEY) === '1';
  } catch {
    return false;
  }
};

export const writeLedgerShadowSwitch = (val) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LEDGER_SHADOW_KEY, val ? '1' : '0');
    }
    return !!val;
  } catch {
    return !!val;
  }
};
