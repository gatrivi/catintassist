import { loadHeaderToggle, saveHeaderToggle, shouldShowIoStrip } from './headerToggles';

beforeEach(() => localStorage.clear());

test('defaults keep the old header: grid off in call, IO strip on', () => {
  expect(loadHeaderToggle('gridInCall')).toBe(false);
  expect(loadHeaderToggle('ioStrip')).toBe(true);
});

test('a toggle is remembered', () => {
  saveHeaderToggle('gridInCall', true);
  saveHeaderToggle('ioStrip', false);
  expect(loadHeaderToggle('gridInCall')).toBe(true);
  expect(loadHeaderToggle('ioStrip')).toBe(false);
});

test('hidden IO strip comes back when audio is broken', () => {
  const base = { ioStripOn: false, isActive: true, isZombieCall: false, audioAttached: true, virtualCableFailure: false };
  expect(shouldShowIoStrip(base)).toBe(false);
  expect(shouldShowIoStrip({ ...base, audioAttached: false })).toBe(true);
  expect(shouldShowIoStrip({ ...base, virtualCableFailure: true })).toBe(true);
  expect(shouldShowIoStrip({ ...base, isActive: false, audioAttached: false })).toBe(false);
});
