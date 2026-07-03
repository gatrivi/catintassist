import {
  consolidateSpelling,
  extractCopyableNames,
  collectCopyableEntities,
} from './transcriptFormat';

describe('consolidateSpelling', () => {
  test('builds word from as-in segments', () => {
    const text = 'S as in Sam, M as in Mary, I as in India, T as in Tom, H as in Henry';
    expect(consolidateSpelling(text, 'en')).toBe('SMITH');
  });

  test('returns null for non-spelling', () => {
    expect(consolidateSpelling('hello world', 'en')).toBeNull();
  });
});

describe('extractCopyableNames', () => {
  test('finds name after my name is', () => {
    const names = extractCopyableNames('Hi my name is John Smith');
    expect(names[0]?.value).toBe('John Smith');
  });

  test('finds Dr name', () => {
    const names = extractCopyableNames('seen by Dr Jane Doe');
    expect(names.some((n) => n.value.includes('Jane'))).toBe(true);
  });
});

describe('collectCopyableEntities', () => {
  test('includes spelling and name chips', () => {
    const text = 'my name is Ana, S as in Sam, M as in Mary, I as in India';
    const ents = collectCopyableEntities(text, 'en');
    expect(ents.some((e) => e.kind === 'name')).toBe(true);
  });
});
