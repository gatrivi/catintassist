import { stampArgs, installConsoleTimestamps } from './consoleTimestamps';

const d = new Date(2026, 9, 16, 14, 7, 5, 42);

test('string first arg gets stamp glued in (keeps %c working)', () => {
  expect(stampArgs(['%c[DG]', 'color:red'], d)).toEqual(['14:07:05.042 %c[DG]', 'color:red']);
});
test('object first arg gets stamp prepended', () => {
  const o = { a: 1 };
  expect(stampArgs([o], d)).toEqual(['14:07:05.042', o]);
});
test('install patches once', () => {
  const seen = [];
  const fake = { log: (...a) => seen.push(a), info() {}, warn() {}, error() {}, debug() {} };
  installConsoleTimestamps(fake);
  installConsoleTimestamps(fake);
  fake.log('hi');
  expect(seen).toHaveLength(1);
  expect(seen[0][0]).toMatch(/^\d\d:\d\d:\d\d\.\d{3} hi$/);
});
