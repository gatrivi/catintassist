/**
 * Terms-of-use consent storage. v1 — first-run consent gate + Settings re-view.
 * localStorage only (device-local, like the rest of the app's settings).
 */

const CONSENT_KEY = 'catint_legal_consent_v1';

const safeParse = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

/** @returns {{ version: string, acceptedAt: string } | null} */
export const readLegalConsent = () => {
  try {
    return safeParse(localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
};

export const isLegalConsentAccepted = (requiredVersion) => {
  const consent = readLegalConsent();
  if (!consent || !consent.version || !consent.acceptedAt) return false;
  if (requiredVersion && consent.version !== requiredVersion) return false;
  return true;
};

export const acceptLegalConsent = (version) => {
  const record = { version, acceptedAt: new Date().toISOString() };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable — consent is session-only then */
  }
  return record;
};

export const revokeLegalConsent = () => {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* ignore */
  }
};
