/**
 * Clinical guards (v4.155.0 / v4.156.0) — two independent switches.
 *
 * The promise under test: with neither switch touched, the app behaves EXACTLY
 * as the previous version did. Any drift here means a default changed.
 */
import {
  isDomainRepairEnabled,
  setDomainRepairEnabled,
  toggleDomainRepair,
  DOMAIN_REPAIR_STORAGE_KEY,
  DOMAIN_REPAIR_CHANGED_EVENT,
  isNegationGuardEnabled,
  setNegationGuardEnabled,
  toggleNegationGuard,
  NEGATION_GUARD_STORAGE_KEY,
  NEGATION_GUARD_CHANGED_EVENT,
} from './clinicalGuards';

describe('clinicalGuards v4.156.0', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('both default to OFF (today behaviour until the operator opts in)', () => {
    expect(isDomainRepairEnabled()).toBe(false);
    expect(isNegationGuardEnabled()).toBe(false);
  });

  test('a broken/absent storage is still OFF for both, never ON', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('no storage');
    });
    expect(isDomainRepairEnabled()).toBe(false);
    expect(isNegationGuardEnabled()).toBe(false);
    spy.mockRestore();
  });

  test('each round-trips independently', () => {
    setDomainRepairEnabled(true);
    expect({ repair: isDomainRepairEnabled(), guard: isNegationGuardEnabled() }).toEqual({
      repair: true,
      guard: false,
    });
    setNegationGuardEnabled(true);
    expect({ repair: isDomainRepairEnabled(), guard: isNegationGuardEnabled() }).toEqual({
      repair: true,
      guard: true,
    });
    setDomainRepairEnabled(false);
    expect({ repair: isDomainRepairEnabled(), guard: isNegationGuardEnabled() }).toEqual({
      repair: false,
      guard: true,
    });
  });

  test('the two switches use different keys (no accidental coupling)', () => {
    expect(DOMAIN_REPAIR_STORAGE_KEY).not.toBe(NEGATION_GUARD_STORAGE_KEY);
    expect(DOMAIN_REPAIR_CHANGED_EVENT).not.toBe(NEGATION_GUARD_CHANGED_EVENT);
  });

  test('only the literal "1" enables a guard', () => {
    localStorage.setItem(DOMAIN_REPAIR_STORAGE_KEY, 'true');
    expect(isDomainRepairEnabled()).toBe(false);
    localStorage.setItem(DOMAIN_REPAIR_STORAGE_KEY, '1');
    expect(isDomainRepairEnabled()).toBe(true);
    localStorage.setItem(NEGATION_GUARD_STORAGE_KEY, 'yes');
    expect(isNegationGuardEnabled()).toBe(false);
  });

  test('each toggle announces its own change (the board listens for this)', () => {
    const repairSeen = [];
    const guardSeen = [];
    const onRepair = (e) => repairSeen.push(e.detail);
    const onGuard = (e) => guardSeen.push(e.detail);
    window.addEventListener(DOMAIN_REPAIR_CHANGED_EVENT, onRepair);
    window.addEventListener(NEGATION_GUARD_CHANGED_EVENT, onGuard);

    expect(toggleDomainRepair()).toBe(true);
    expect(toggleNegationGuard()).toBe(true);
    expect(toggleDomainRepair()).toBe(false);
    expect(toggleNegationGuard()).toBe(false);

    window.removeEventListener(DOMAIN_REPAIR_CHANGED_EVENT, onRepair);
    window.removeEventListener(NEGATION_GUARD_CHANGED_EVENT, onGuard);
    // The repair switch must not announce anything on the guard channel.
    expect(repairSeen).toEqual([true, false]);
    expect(guardSeen).toEqual([true, false]);
  });
});

