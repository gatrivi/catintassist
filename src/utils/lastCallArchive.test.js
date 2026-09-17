// CRA resets mock impls before each test — assign in beforeEach.
jest.mock('idb-keyval');
const { set: idbSet, get: idbGet, del: idbDel } = require('idb-keyval');
const mockIdbStore = new Map();
beforeEach(() => {
  mockIdbStore.clear();
  idbSet.mockImplementation(async (k, v) => { mockIdbStore.set(k, v); });
  idbGet.mockImplementation(async (k) => mockIdbStore.get(k));
  idbDel.mockImplementation(async (k) => { mockIdbStore.delete(k); });
});

import {
  buildLastCallArchive,
  isSealableArchive,
  saveLastCallArchive,
  loadLastCallArchive,
  clearLastCallArchive,
} from './lastCallArchive';

test('empty / blank captions are not sealable', () => {
  expect(isSealableArchive([])).toBe(false);
  expect(isSealableArchive(null)).toBe(false);
  expect(isSealableArchive([{ text: '   ' }])).toBe(false);
  expect(isSealableArchive([{ text: 'hola' }])).toBe(true);
});

test('build drops blanks and caps length', () => {
  const caps = [{ text: '  ' }, ...Array.from({ length: 600 }, (_, i) => ({ text: `m${i}` }))];
  const archive = buildLastCallArchive(caps);
  expect(archive.captions.length).toBe(500);
  expect(archive.captions[0].text).toBe('m100');
  expect(typeof archive.endedAt).toBe('number');
});

test('save/load/clear round-trips through IDB', async () => {
  await clearLastCallArchive();
  expect(await loadLastCallArchive()).toBeNull();
  expect(await saveLastCallArchive([])).toBe(false);
  expect(await saveLastCallArchive([{ text: 'tiene cáncer', lang: 'es' }])).toBe(true);
  const loaded = await loadLastCallArchive();
  expect(loaded.captions[0].text).toBe('tiene cáncer');
  await clearLastCallArchive();
  expect(await loadLastCallArchive()).toBeNull();
});
