/**
 * Domain-repair switch (v4.155.0).
 *
 * Default OFF is the whole point: an unfixed pipeline must behave EXACTLY like
 * v4.154.0 until the operator opts in.
 */
import {
  isDomainRepairEnabled,
  setDomainRepairEnabled,
  toggleDomainRepair,
  DOMAIN_REPAIR_STORAGE_KEY,
  DOMAIN_REPAIR_CHANGED_EVENT,
} from './domainRepairSetting';

describe('domainRepairSetting v4.155.0', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('defaults to OFF (pure Deepgram text until the operator opts in)', () => {
    expect(isDomainRepairEnabled()).toBe(false);
  });

  test('a broken/absent storage is still OFF, never ON', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('no storage');
    });
    expect(isDomainRepairEnabled()).toBe(false);
    spy.mockRestore();
  });

  test('round-trips ON', () => {
    setDomainRepairEnabled(true);
    expect(isDomainRepairEnabled()).toBe(true);
    setDomainRepairEnabled(false);
    expect(isDomainRepairEnabled()).toBe(false);
  });

  test('only the literal "1" enables it', () => {
    localStorage.setItem(DOMAIN_REPAIR_STORAGE_KEY, 'true');
    expect(isDomainRepairEnabled()).toBe(false);
    localStorage.setItem(DOMAIN_REPAIR_STORAGE_KEY, '1');
    expect(isDomainRepairEnabled()).toBe(true);
  });

  test('toggles and announces the change (the board listens for this)', () => {
    const seen = [];
    const onChange = (e) => seen.push(e.detail);
    window.addEventListener(DOMAIN_REPAIR_CHANGED_EVENT, onChange);
    expect(toggleDomainRepair()).toBe(true);
    expect(toggleDomainRepair()).toBe(false);
    window.removeEventListener(DOMAIN_REPAIR_CHANGED_EVENT, onChange);
    expect(seen).toEqual([true, false]);
  });
});
