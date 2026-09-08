import {
  STUDY_CARDS,
  cardsForDomain,
  normalizeTerm,
  readStudyDomain,
  seededShuffle,
  validateDecks,
  writeStudyDomain,
  STUDY_DOMAIN_KEY,
} from './studyDecks';

describe('studyDecks (v4.88.0 cue cards)', () => {
  it('shipped deck passes validation — no dupes, no empty fields', () => {
    const { errors } = validateDecks(STUDY_CARDS);
    expect(errors).toEqual([]);
  });

  it('deck covers every study domain', () => {
    const domains = new Set(STUDY_CARDS.map((c) => c.domain));
    ['auto', 'insurance', 'education', 'utilities', 'financial', 'social', 'medical', 'general'].forEach((d) => {
      expect(domains.has(d)).toBe(true);
    });
  });

  it('validator catches duplicate EN terms (airbag-style dupes)', () => {
    const dup = [...STUDY_CARDS, { type: 'glossary', domain: 'auto', en: 'Airbag', es: 'x' }];
    const { errors } = validateDecks(dup);
    expect(errors.some((e) => e.includes('duplicate EN term'))).toBe(true);
  });

  it('validator catches broken entries', () => {
    const { errors } = validateDecks([{ type: 'glossary', domain: 'auto', en: '', es: '' }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('domain filter keeps qa cards in every domain; all returns everything', () => {
    const med = cardsForDomain(STUDY_CARDS, 'medical');
    expect(med.length).toBeGreaterThan(0);
    expect(med.every((c) => c.domain === 'medical' || c.type === 'qa')).toBe(true);
    expect(cardsForDomain(STUDY_CARDS, 'all')).toHaveLength(STUDY_CARDS.length);
  });

  it('normalizeTerm collapses case/spacing', () => {
    expect(normalizeTerm('  Driver’s   License ')).toBe('driver’s license');
  });

  it('seededShuffle is deterministic and preserves contents', () => {
    const a = seededShuffle(STUDY_CARDS, 42);
    const b = seededShuffle(STUDY_CARDS, 42);
    expect(a).toEqual(b);
    expect(seededShuffle(STUDY_CARDS, 7)).not.toEqual(a);
    expect(a.map(JSON.stringify).sort()).toEqual(STUDY_CARDS.map(JSON.stringify).sort());
  });

  it('domain preference round-trips through localStorage', () => {
    localStorage.clear();
    expect(readStudyDomain()).toBe('all');
    writeStudyDomain('medical');
    expect(localStorage.getItem(STUDY_DOMAIN_KEY)).toBe('medical');
    expect(readStudyDomain()).toBe('medical');
    writeStudyDomain('bogus'); // ignored
    expect(readStudyDomain()).toBe('medical');
  });
});
