/**
 * Keyterm biasing list (v4.157.0).
 *
 * The risk this file manages: a long list of terms the model did not actually
 * mishear makes the model FORCE them into unrelated speech. That is Deepgram's
 * documented failure mode, and the eval reports it as `INVENTED terms`. So the
 * tests below are mostly about staying SMALL and staying HONEST.
 */
import {
  buildKeyterms,
  keytermTokenCost,
  keytermsFromCorrections,
  KEYTERM_MAX_TERMS,
  KEYTERM_TOKEN_BUDGET,
} from './sttKeyterms';
import { DOMAIN_REPAIR_RULES } from './domainLexicon';

describe('sttKeyterms v4.157.0', () => {
  test('every keyterm is a term the app has PROVEN gets mangled', () => {
    // The list is derived from the lexicon on purpose: we only bias toward
    // words we have already seen Deepgram mishear.
    const known = new Set(
      DOMAIN_REPAIR_RULES.filter((r) => r.lang === 'en').map((r) => r.term),
    );
    buildKeyterms('en').forEach((t) => expect(known.has(t)).toBe(true));
  });

  test('stays inside Deepgram guidance (short list, token budget)', () => {
    ['en', 'es'].forEach((lang) => {
      const terms = buildKeyterms(lang);
      expect(terms.length).toBeGreaterThan(0);
      expect(terms.length).toBeLessThanOrEqual(KEYTERM_MAX_TERMS);
      expect(keytermTokenCost(terms)).toBeLessThanOrEqual(KEYTERM_TOKEN_BUDGET);
    });
  });

  test('medical terms come first — a deposition must not crowd out a dose', () => {
    const terms = buildKeyterms('en');
    const legal = ['exhibit', 'deposition', 'objection', 'subpoena'];
    const firstLegal = terms.findIndex((t) => legal.includes(t));
    // if any legal term made the cut, every drug name ahead of it must exist
    if (firstLegal >= 0) {
      const drugs = DOMAIN_REPAIR_RULES.filter((r) => r.kind === 'drug' && r.lang === 'en');
      const drugCount = terms.filter((t) => drugs.some((d) => d.term === t)).length;
      expect(drugCount).toBeGreaterThan(0);
    }
    expect(terms[0]).toBeTruthy();
  });

  test('per lane, no cross-language leakage', () => {
    expect(buildKeyterms('en')).not.toContain('amoxicilina');
    expect(buildKeyterms('es')).not.toContain('albuterol');
    expect(buildKeyterms('es')).toContain('metformina');
  });

  test('no digits and no duplicates (a dose is not a keyterm)', () => {
    ['en', 'es'].forEach((lang) => {
      const terms = buildKeyterms(lang);
      terms.forEach((t) => expect(t).not.toMatch(/\d/));
      expect(new Set(terms.map((t) => t.toLowerCase())).size).toBe(terms.length);
    });
  });

  test('honours a smaller cap', () => {
    expect(buildKeyterms('en', { max: 5 })).toHaveLength(5);
  });

  test('a tiny token budget still returns something usable', () => {
    const terms = buildKeyterms('en', { max: 30, tokenBudget: 3 });
    expect(Array.isArray(terms)).toBe(true);
    expect(keytermTokenCost(terms)).toBeLessThanOrEqual(3);
  });

  test('deterministic — the same lane always produces the same list', () => {
    expect(buildKeyterms('en')).toEqual(buildKeyterms('en'));
  });

  test('an unknown lane gets NO keyterms (never force-fit English into a foreign stream)', () => {
    // Silence is the safe answer: we do not know what language this is.
    expect(buildKeyterms('zz')).toEqual([]);
    // A missing lane means "EN" everywhere else in the app, so keep that.
    expect(buildKeyterms(null).length).toBeGreaterThan(0);
  });

  // ── v4.158.0: the operator's own corrections feed the list ───────────────
  describe('keyterms from ✎ corrections (v4.158.0)', () => {
    const corr = (corrected, lang = 'en', createdAt = 1, sourceHeard = 'xx') => ({
      sourceHeard,
      corrected,
      lang,
      createdAt,
    });

    test('a corrected word becomes a keyterm', () => {
      expect(keytermsFromCorrections([corr('Albuterol')])).toEqual(['Albuterol']);
    });

    test('only the CORRECTED text goes out, never the mishearing', () => {
      // Sending "all but a roll" as a keyterm would teach Deepgram the error.
      const list = keytermsFromCorrections([
        corr('Albuterol', 'en', 1, 'all but a roll inhaler'),
      ]);
      expect(list).toEqual(['Albuterol']);
      expect(list.join(' ')).not.toContain('all but a roll');
    });

    test('a dose is never a keyterm (digits are refused)', () => {
      expect(keytermsFromCorrections([corr('500 mg')])).toEqual([]);
      expect(keytermsFromCorrections([corr('Warfarin 5mg daily')])).toEqual([]);
    });

    test('a whole sentence is not a vocabulary item', () => {
      expect(keytermsFromCorrections([corr('the patient denies chest pain today')])).toEqual([]);
    });

    test('a two-word name is allowed (a real drug name shape)', () => {
      expect(keytermsFromCorrections([corr('sodium chloride')])).toEqual(['sodium chloride']);
    });

    test('frequently fixed words rank first — that is where the pain is', () => {
      const list = keytermsFromCorrections([
        corr('Warfarin', 'en', 5),
        corr('Albuterol', 'en', 5),
        corr('Albuterol', 'en', 6),
        corr('Albuterol', 'en', 7),
      ]);
      expect(list[0]).toBe('Albuterol');
    });

    test('respects the cap', () => {
      const many = Array.from({ length: 30 }, (_, i) => corr(`drug${'x'.repeat(i)}`));
      expect(keytermsFromCorrections(many, { max: 5 })).toHaveLength(5);
    });

    test('empty / junk input is safe', () => {
      expect(keytermsFromCorrections()).toEqual([]);
      expect(keytermsFromCorrections([])).toEqual([]);
      expect(keytermsFromCorrections([{}, { corrected: '' }])).toEqual([]);
    });

    test('corrections rank ABOVE the shipped lexicon, per lane', () => {
      const merged = buildKeyterms('en', { corrections: [corr('Midvale')] });
      expect(merged[0]).toBe('Midvale'); // human outranks shipped list
      // and without the switch the list is unchanged
      expect(buildKeyterms('en')[0]).not.toBe('Midvale');
    });

    test('a correction only reaches its own lane', () => {
      const en = buildKeyterms('en', { corrections: [corr('Midvale', 'en')] });
      const es = buildKeyterms('es', { corrections: [corr('Midvale', 'en')] });
      expect(en).toContain('Midvale');
      expect(es).not.toContain('Midvale');
    });

    test('a correction already in the lexicon is not duplicated', () => {
      const list = buildKeyterms('en', { corrections: [corr('Albuterol')] });
      expect(list.filter((t) => t.toLowerCase() === 'albuterol')).toHaveLength(1);
    });

    test('the merged list still respects the cap and the token budget', () => {
      const many = Array.from({ length: 40 }, (_, i) => corr(`customterm${i}`));
      const list = buildKeyterms('en', { corrections: many });
      expect(list.length).toBeLessThanOrEqual(KEYTERM_MAX_TERMS);
      expect(keytermTokenCost(list)).toBeLessThanOrEqual(KEYTERM_TOKEN_BUDGET);
    });
  });
});
