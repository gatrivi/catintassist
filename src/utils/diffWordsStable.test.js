import {
  diffWordsStable,
  isProtectedToken,
  isAppendOnlyMorph,
  tokenizeWords,
} from './diffWordsStable';

describe('diffWordsStable', () => {
  test('tokenizeWords keeps trailing spaces', () => {
    expect(tokenizeWords('take fifty ').join('')).toBe('take fifty ');
  });

  test('append-only is mostly equal + insert', () => {
    const ops = diffWordsStable('my phone is ', 'my phone is 555');
    expect(isAppendOnlyMorph('my phone is ', 'my phone is 555')).toBe(true);
    expect(ops.filter((o) => o.type === 'equal').length).toBeGreaterThanOrEqual(2);
    expect(ops.some((o) => o.type === 'insert')).toBe(true);
  });

  test('fifty → fifteen is a replace, not blank', () => {
    const ops = diffWordsStable(
      'take fifty milligrams twice a day',
      'take fifteen milligrams twice a day',
    );
    const rep = ops.find((o) => o.type === 'replace');
    expect(rep).toBeTruthy();
    expect(rep.from.trim()).toMatch(/fifty/i);
    expect(rep.to.trim()).toMatch(/fifteen/i);
    expect(ops.every((o) => o.type === 'equal' || o.type === 'replace')).toBe(true);
    // No empty gap: joined next text reconstructable from equal+replace.to
    const rebuilt = ops
      .map((o) => (o.type === 'equal' ? o.text : o.type === 'replace' ? o.to : ''))
      .join('');
    expect(rebuilt.replace(/\s+/g, ' ').trim()).toBe(
      'take fifteen milligrams twice a day',
    );
  });

  test('isProtectedToken catches phones and doses', () => {
    expect(isProtectedToken('555-123-4567')).toBe(true);
    expect(isProtectedToken('500mg')).toBe(true);
    expect(isProtectedToken('01/02/1970')).toBe(true);
    expect(isProtectedToken('May 8 1990')).toBe(true);
    expect(isProtectedToken('hello')).toBe(false);
  });
});
