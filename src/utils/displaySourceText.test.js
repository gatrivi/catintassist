/**
 * The promise of v4.155.0, tested where it is cheap to test: with the switch
 * OFF the bubble must be byte-identical to what v4.154.0 showed.
 */
import { resolveDisplayText } from './displaySourceText';
import { clearCorrections, saveCorrection } from './transcriptCorrections';

const MANGLED = 'Give all but a roll inhaler two puffs.';

describe('resolveDisplayText v4.155.0', () => {
  afterEach(() => clearCorrections());

  test('switch OFF = pure Deepgram text (nothing repaired)', () => {
    const r = resolveDisplayText({ text: MANGLED, lang: 'en', domainRepairOn: false });
    expect(r.text).toBe(MANGLED);
    expect(r.repairs).toEqual([]);
  });

  test('switch ON repairs the known mishearing', () => {
    const r = resolveDisplayText({ text: MANGLED, lang: 'en', domainRepairOn: true });
    expect(r.text).toBe('Give albuterol inhaler two puffs.');
    expect(r.repairs).toHaveLength(1);
  });

  test('a user ✎ correction always wins over the lexicon', () => {
    saveCorrection({ sourceHeard: 'all but a roll', corrected: 'Albuterol', lang: 'en' });
    const user = resolveDisplayText({ text: MANGLED, lang: 'en', userCorrected: true, domainRepairOn: true });
    expect(user.text).toBe(MANGLED); // untouched: the human already fixed this bubble
  });

  test('corrections store still applies with the lexicon on', () => {
    saveCorrection({ sourceHeard: 'mid vail', corrected: 'Midvale', lang: 'en' });
    expect(resolveDisplayText({ text: 'lives in Midvale Utah', lang: 'en' }).text).toBe(
      'lives in Midvale Utah',
    );
    expect(
      resolveDisplayText({ text: 'lives in mid vail Utah', lang: 'en', domainRepairOn: true }).text,
    ).toBe('lives in Midvale Utah');
  });

  test('a dropped negation is reported, never written into the text', () => {
    const r = resolveDisplayText({
      text: 'She is allergic to penicillin.',
      lang: 'en',
      domainRepairOn: true,
    });
    expect(r.text).toBe('She is allergic to penicillin.');
    expect(r.negated.length).toBeGreaterThan(0);
  });

  test('empty / missing text is safe', () => {
    expect(resolveDisplayText({}).text).toBe('');
    expect(resolveDisplayText().text).toBe('');
  });
});
