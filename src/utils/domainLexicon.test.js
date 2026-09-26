/**
 * Domain lexicon + display-side repair (v4.155.0).
 *
 * These tests are the safety contract. A medical transcript is not a place to
 * be clever: each rule below is a promise we make to the interpreter.
 */
import {
  applyDomainRepair,
  findNegationGaps,
  SAFE_DOMAIN_REPAIR_RULES,
  DOMAIN_REPAIR_RULES,
} from './domainLexicon';

const digits = (t) => (String(t || '').match(/\d+/g) || []).join(',');

describe('domainLexicon v4.155.0', () => {
  test('fixes a drug name heard as English words', () => {
    const r = applyDomainRepair('Give all but a roll inhaler two puffs.', 'en');
    expect(r.text).toBe('Give albuterol inhaler two puffs.');
    expect(r.repairs).toEqual([{ from: 'all but a roll', to: 'albuterol', kind: 'drug' }]);
    expect(r.reverted).toBe(false);
  });

  test('is case- and whitespace-insensitive', () => {
    expect(applyDomainRepair('ALL   BUT A  ROLL inhaler now', 'en').text).toBe('albuterol inhaler now');
  });

  test('is idempotent — repairing twice changes nothing the second time', () => {
    const once = applyDomainRepair('Give all but a roll inhaler.', 'en');
    const twice = applyDomainRepair(once.text, 'en');
    expect(twice.text).toBe(once.text);
    expect(twice.repairs).toEqual([]);
  });

  test('NEVER touches digits (doses and vitals are untouchable)', () => {
    const text = 'Give all but a roll inhaler 2 puffs, 90 mg, every 4 hours.';
    const r = applyDomainRepair(text, 'en');
    expect(r.text).toContain('albuterol');
    expect(digits(r.text)).toBe(digits(text));
  });

  test('a rule carrying a digit is refused at load time', () => {
    const dirty = { term: 'warfarin', lang: 'en', kind: 'drug', mishears: ['5 mg'], context: [] };
    // eslint-disable-next-line global-require
    const { SAFE_DOMAIN_REPAIR_RULES: safe } = require('./domainLexicon');
    expect(safe).not.toContain(dirty);
    expect(safe.every((r) => !/\d/.test(r.term) && r.mishears.every((m) => !/\d/.test(m)))).toBe(true);
  });

  test('if a repair WOULD move a digit the whole repair is thrown away', () => {
    // A hypothetical bad rule that rewrites a number. The context gate passes,
    // so the only thing standing between the interpreter and a wrong dose is
    // the digit check at the end of applyDomainRepair.
    const evil = { term: 'mgs', lang: 'en', kind: 'drug', mishears: ['5'], context: ['take'] };
    const r = applyDomainRepair('take 5 mg', 'en', { rules: [evil] });
    expect(r.reverted).toBe(true);
    expect(r.text).toBe('take 5 mg');
    expect(r.repairs).toEqual([]);
  });

  test('a rule with no context word can never fire (the context gate holds)', () => {
    const noContext = { term: 'rolls', lang: 'en', kind: 'drug', mishears: ['all but a roll'], context: [] };
    const r = applyDomainRepair('Give all but a roll inhaler.', 'en', { rules: [noContext] });
    expect(r.repairs).toEqual([]);
    expect(r.text).toBe('Give all but a roll inhaler.');
  });

  test('no context word nearby = left alone (it is just English)', () => {
    const text = 'He said all but a roll of the tickets were fine.';
    const r = applyDomainRepair(text, 'en');
    expect(r.text).toBe(text);
    expect(r.repairs).toEqual([]);
  });

  test('legal slice: exhibit heard as "exit bit"', () => {
    const r = applyDomainRepair('Please mark exit bit into the record.', 'en');
    expect(r.text).toBe('Please mark exhibit into the record.');
    expect(r.repairs[0].kind).toBe('legal');
  });

  test('ES rules only fire on ES text (and vice versa)', () => {
    const es = applyDomainRepair('Tome metform ina 500 mg al día.', 'es');
    expect(es.text).toBe('Tome metformina 500 mg al día.');
    // the EN "insulin" rule must not fire on Spanish text
    expect(applyDomainRepair('in sulin', 'es').text).toBe('in sulin');
  });

  test('ES accents are handled (fold before matching)', () => {
    expect(applyDomainRepair('dosis de amoxic ilina 500 mg', 'es').text).toBe(
      'dosis de amoxicilina 500 mg',
    );
  });

  test('NEVER invents a missing negation — only reports it', () => {
    const text = 'Patient chest pain'; // "denies" dropped by the provider
    const r = applyDomainRepair(text, 'en');
    expect(r.text).toBe(text); // unchanged, on purpose
    expect(r.negated.length).toBeGreaterThan(0);
  });

  test('a present negation silences the gap report', () => {
    expect(findNegationGaps('She denies any allergy to penicillin.', 'en')).toEqual([]);
    expect(findNegationGaps('Niega alergias a medicamentos.', 'es')).toEqual([]);
  });

  test('ES negation gap is reported', () => {
    expect(findNegationGaps('Paciente con disnea.', 'es').length).toBeGreaterThan(0);
  });

  test('empty / nullish text is returned untouched', () => {
    expect(applyDomainRepair('', 'en')).toEqual({ text: '', repairs: [], reverted: false, negated: [] });
    expect(applyDomainRepair(null, 'en').text).toBe('');
  });

  test('the table is short and clean on purpose', () => {
    expect(SAFE_DOMAIN_REPAIR_RULES.length).toBeGreaterThanOrEqual(25);
    expect(SAFE_DOMAIN_REPAIR_RULES.length).toBeLessThanOrEqual(DOMAIN_REPAIR_RULES.length);
    SAFE_DOMAIN_REPAIR_RULES.forEach((r) => {
      expect(typeof r.term).toBe('string');
      expect(r.mishears.length).toBeGreaterThan(0);
      expect(Array.isArray(r.context)).toBe(true);
    });
  });

  test('no duplicate terms in the table', () => {
    const keys = DOMAIN_REPAIR_RULES.map((r) => `${r.lang}:${r.term}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
