import {
  acceptLegalConsent,
  isLegalConsentAccepted,
  readLegalConsent,
  revokeLegalConsent,
} from './legalConsent';

describe('legalConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('not accepted when nothing stored', () => {
    expect(readLegalConsent()).toBeNull();
    expect(isLegalConsentAccepted('1.0.0')).toBe(false);
  });

  test('accept records version and timestamp and satisfies check', () => {
    const record = acceptLegalConsent('1.0.0');
    expect(record.version).toBe('1.0.0');
    expect(new Date(record.acceptedAt).getTime()).not.toBeNaN();
    expect(isLegalConsentAccepted('1.0.0')).toBe(true);
  });

  test('version mismatch means not accepted (re-prompt on legal change)', () => {
    acceptLegalConsent('1.0.0');
    expect(isLegalConsentAccepted('1.0.1')).toBe(false);
    // No requiredVersion → any recorded consent counts (Settings re-view path).
    expect(isLegalConsentAccepted()).toBe(true);
  });

  test('corrupt payload is treated as not accepted', () => {
    localStorage.setItem('catint_legal_consent_v1', '{not json');
    expect(readLegalConsent()).toBeNull();
    expect(isLegalConsentAccepted('1.0.0')).toBe(false);
  });

  test('non-object payload is treated as not accepted', () => {
    localStorage.setItem('catint_legal_consent_v1', '42');
    expect(readLegalConsent()).toBeNull();
  });

  test('revoke clears consent', () => {
    acceptLegalConsent('1.0.0');
    revokeLegalConsent();
    expect(readLegalConsent()).toBeNull();
    expect(isLegalConsentAccepted('1.0.0')).toBe(false);
  });
});
