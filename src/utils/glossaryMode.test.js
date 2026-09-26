/**
 * Phrase-level glossary + mode (v4.161.0).
 *
 * Motivation: a real CSA call where sentence-exact pinning would have meant
 * re-pinning the same term in every new phrasing, by hand, under time pressure.
 *
 * The shape of this file matters more than usual: phrase mode REWRITES the text
 * the translator receives, so a wrong match corrupts a real sentence. Most of
 * these tests are therefore "must NOT fire".
 */
import {
  applyGlossaryPhrases,
  loadGlossary,
  removeCorrection,
  clearGlossary,
  saveCorrection,
  clearCorrections,
  GLOSSARY_MIN_PHRASE_WORDS,
  GLOSSARY_MIN_SINGLE_PIN_CHARS,
} from './transcriptCorrections';
import {
  loadGlossaryMode,
  saveGlossaryMode,
  cycleGlossaryMode,
  GLOSSARY_MODES,
} from './glossaryMode';

const pin = (sourceHeard, corrected) =>
  saveCorrection({
    sourceHeard,
    corrected,
    lang: 'en',
    targetLang: 'es',
    kind: 'glossary',
  });

describe('phrase glossary v4.161.0', () => {
  beforeEach(() => clearCorrections());

  test('a pinned term is applied inside an unrelated sentence', () => {
    pin('behavioral health', 'salud conductual');
    const r = applyGlossaryPhrases(
      'I could also send some referrals for behavioral health right away',
      'en',
      'es',
    );
    expect(r.text).toContain('salud conductual');
    expect(r.applied).toHaveLength(1);
  });

  test('the specific pin beats the general one (longest wins)', () => {
    pin('behavioral health', 'salud conductual');
    pin('referrals for behavioral health', 'derivaciones de salud mental');
    const r = applyGlossaryPhrases(
      'I will send some referrals for behavioral health today',
      'en',
      'es',
    );
    expect(r.text).toContain('derivaciones de salud mental');
    // the shorter pin must not then re-fire inside what the longer one produced
    expect(r.text).not.toContain('salud conductual');
  });

  test('a single substantial word CAN be pinned (CSA terms are single words)', () => {
    pin('disclosure', 'divulgación');
    expect(applyGlossaryPhrases('the disclosure was made', 'en', 'es').applied).toHaveLength(1);
  });

  test('a short single word is refused (pinning "no" would corrupt every sentence)', () => {
    pin('no', 'negativo');
    pin('the', 'el');
    expect(applyGlossaryPhrases('there is no fever and the patient rests', 'en', 'es').applied).toEqual(
      [],
    );
  });

  test('word boundaries: a pin cannot fire inside a longer word', () => {
    pin('referral', 'derivación');
    expect(applyGlossaryPhrases('the referrals are ready', 'en', 'es').applied).toEqual([]);
    expect(applyGlossaryPhrases('the referral is ready', 'en', 'es').text).toContain('derivación');
  });

  test('case and accents are ignored', () => {
    pin('disclosure', 'divulgación');
    const r = applyGlossaryPhrases('After the Disclosure was made', 'en', 'es');
    expect(r.applied).toHaveLength(1);
    expect(r.text).toContain('divulgación');
  });

  test('single-word pins need at least 4 characters', () => {
    expect(GLOSSARY_MIN_SINGLE_PIN_CHARS).toBe(4);
  });

  test('never touches another language pair', () => {
    pin('behavioral health', 'salud conductual');
    expect(applyGlossaryPhrases('referrals for behavioral health', 'en', 'fr').applied).toEqual([]);
  });

  test('text with no pins comes back byte-identical', () => {
    const text = 'Give albuterol inhaler two puffs.';
    expect(applyGlossaryPhrases(text, 'en', 'es').text).toBe(text);
  });

  test('empty / junk input is safe', () => {
    expect(applyGlossaryPhrases('', 'en', 'es').text).toBe('');
    expect(applyGlossaryPhrases(null, 'en', 'es').text).toBe('');
  });

  test('the operator can delete one pin, or all of them', () => {
    const a = pin('behavioral health', 'salud conductual');
    pin('disclosure', 'divulgación');
    expect(loadGlossary('en', 'es')).toHaveLength(2);
    expect(removeCorrection(a.key)).toBe(true);
    expect(loadGlossary('en', 'es')).toHaveLength(1);
    expect(clearGlossary('en', 'es')).toBe(1);
    expect(loadGlossary('en', 'es')).toHaveLength(0);
    expect(removeCorrection('nope')).toBe(false);
  });
});

describe('glossary mode — the operator decides (v4.161.0)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCorrections();
  });

  test('defaults to EXACT: identical behaviour to before this release', () => {
    expect(loadGlossaryMode()).toBe('exact');
  });

  test('every mode round-trips, and junk falls back to exact', () => {
    GLOSSARY_MODES.forEach((m) => {
      expect(saveGlossaryMode(m)).toBe(m);
      expect(loadGlossaryMode()).toBe(m);
    });
    expect(saveGlossaryMode('nonsense')).toBe('exact');
    localStorage.setItem('catint_glossary_mode_v1', 'nonsense');
    expect(loadGlossaryMode()).toBe('exact');
  });

  test('cycles through all three so one button can offer the choice', () => {
    expect(cycleGlossaryMode()).toBe('phrase');
    expect(cycleGlossaryMode()).toBe('off');
    expect(cycleGlossaryMode()).toBe('exact');
  });

  test('a broken storage falls back to exact (never silently off)', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('no storage');
    });
    expect(loadGlossaryMode()).toBe('exact');
    spy.mockRestore();
  });
});
