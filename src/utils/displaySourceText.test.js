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
      text: 'Patient chest pain',
      lang: 'en',
      domainRepairOn: true,
    });
    expect(r.text).toBe('Patient chest pain'); // untouched, on purpose
    expect(r.negated.length).toBeGreaterThan(0);
  });

  test('an ordinary affirmative is NOT treated as a dropped negation', () => {
    // "He is allergic to penicillin" is a normal sentence a patient says all day.
    // Flagging it would fire constantly, and a guard that fires constantly gets
    // muted — see negationGuard.test.js for the full precision set.
    expect(
      resolveDisplayText({ text: 'He is allergic to penicillin', lang: 'en', domainRepairOn: true })
        .negated,
    ).toEqual([]);
  });

  test('v4.156.0 — the guard works with the repair switch OFF (they are independent)', () => {
    // The safe half must not hide behind the risky half: with everything off,
    // the text is untouched AND the warning is still computed.
    const r = resolveDisplayText({ text: 'Patient chest pain', lang: 'en', domainRepairOn: false });
    expect(r.text).toBe('Patient chest pain');
    expect(r.negated.length).toBeGreaterThan(0);
  });

  test('v4.156.0 — a human-fixed bubble is never flagged', () => {
    const r = resolveDisplayText({
      text: 'Patient chest pain',
      lang: 'en',
      userCorrected: true,
      domainRepairOn: true,
    });
    expect(r.negated).toEqual([]); // the human vouches for it
  });

  test('v4.156.0 — a clean line reports nothing', () => {
    expect(resolveDisplayText({ text: 'Take one tablet twice daily', lang: 'en' }).negated).toEqual([]);
    expect(resolveDisplayText({ text: 'Tome una tableta', lang: 'es' }).negated).toEqual([]);
  });

  test('empty / missing text is safe', () => {
    expect(resolveDisplayText({}).text).toBe('');
    expect(resolveDisplayText().text).toBe('');
  });
});
