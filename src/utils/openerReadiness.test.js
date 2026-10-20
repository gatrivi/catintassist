import { openerReadiness } from './openerReadiness';

const b = {};
const all = { greeting_es_morning: b, greeting_es_afternoon: b, greeting_es_evening: b };

test('nothing recorded = none, even with CALL OK', () => {
  expect(openerReadiness('greeting_es', {}, true).state).toBe('none');
});
test('recorded but no CALL OK = locked', () => {
  expect(openerReadiness('greeting_es', all, false).state).toBe('locked');
});
test('mic-test mode ignores CALL OK', () => {
  expect(openerReadiness('greeting_es', all, false, false).state).toBe('ok');
});
test('missing slots = partial, names them', () => {
  const r = openerReadiness('greeting_es', { greeting_es_morning: b }, true);
  expect(r).toMatchObject({ state: 'partial', glyph: '1/3', missing: ['afternoon', 'evening'], lang: 'ES' });
  expect(r.text).toMatch(/Afternoon, Evening/);
});
test('all 3 + CALL OK = ok', () => {
  expect(openerReadiness('greeting_es', all, true).glyph).toBe('✓');
});
