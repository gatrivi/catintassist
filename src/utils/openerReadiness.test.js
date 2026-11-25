import { openerReadiness } from './openerReadiness';

describe('openerReadiness', () => {
  test('returns none (✗) when no recordings exist', () => {
    const res = openerReadiness('greeting_es', {});
    expect(res).toMatchObject({
      lang: 'ES',
      state: 'none',
      status: 'none',
      glyph: '✗',
      badge: '✗',
      count: 0,
      total: 3,
    });
  });

  test('returns partial (1/3 and 2/3) when some time-of-day clips are recorded', () => {
    const one = openerReadiness('greeting_es', {
      greeting_es_morning: new Blob(['a']),
    });
    expect(one).toMatchObject({
      lang: 'ES',
      state: 'partial',
      status: 'partial',
      glyph: '1/3',
      badge: '1/3',
      count: 1,
      total: 3,
      missing: ['afternoon', 'evening'],
    });
    expect(one.text).toMatch(/Afternoon, Evening/);

    const two = openerReadiness('greeting_es', {
      greeting_es_morning: new Blob(['a']),
      greeting_es_evening: new Blob(['b']),
    });
    expect(two).toMatchObject({
      state: 'partial',
      status: 'partial',
      glyph: '2/3',
      badge: '2/3',
      count: 2,
      total: 3,
    });
  });

  test('returns ok (✓) when all 3 time-of-day clips are recorded, with no CALL OK lock', () => {
    const res = openerReadiness('greeting_es', {
      greeting_es_morning: new Blob(['a']),
      greeting_es_afternoon: new Blob(['b']),
      greeting_es_evening: new Blob(['c']),
    });

    expect(res).toMatchObject({
      state: 'ok',
      status: 'ok',
      glyph: '✓',
      badge: '✓',
      count: 3,
      total: 3,
    });
    expect(res.status).not.toBe('locked');
    expect(res.badge).not.toContain('🔒');
  });

  test('returns ok (✓) for a single-slot clip stored directly under actionId', () => {
    const res = openerReadiness('es_close', {
      es_close: new Blob(['done']),
    });

    expect(res).toMatchObject({
      state: 'ok',
      status: 'ok',
      glyph: '✓',
      badge: '✓',
      count: 1,
      total: 1,
    });
  });

  test('handles null/undefined blobs gracefully', () => {
    expect(openerReadiness('greeting_en', null)).toMatchObject({
      state: 'none',
      status: 'none',
      badge: '✗',
    });
    expect(openerReadiness('greeting_en', undefined)).toMatchObject({
      state: 'none',
      status: 'none',
      badge: '✗',
    });
  });
});
