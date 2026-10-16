import { digitsShownElsewhere } from './captionEngine';

const rows = [
  { id: 'a', text: 'Call me at 555-123-4567.' },
  { id: 'b', text: 'Zip 10001.' },
  { id: 'cur', text: 'My number is 555-123-4567 and zip 10001' },
];

describe('digitsShownElsewhere (v4.181.0)', () => {
  test('nothing lost = fine', () => expect(digitsShownElsewhere(rows, 'cur', [])).toBe(true));
  test('duplicate still visible in another row may go', () =>
    expect(digitsShownElsewhere(rows, 'cur', ['5551234567', '10001'])).toBe(true));
  test('the only copy never goes', () =>
    expect(digitsShownElsewhere(rows, 'cur', ['93550'])).toBe(false));
  test('the current row never counts as "elsewhere"', () =>
    expect(digitsShownElsewhere([{ id: 'cur', text: '93550' }], 'cur', ['93550'])).toBe(false));
  test('a copy scrolled past the last 5 rows does not count', () => {
    const old = [{ id: 'o', text: '93550' }, ...[1, 2, 3, 4, 5].map((n) => ({ id: `r${n}`, text: 'hi' }))];
    expect(digitsShownElsewhere(old, 'cur', ['93550'])).toBe(false);
  });
});
