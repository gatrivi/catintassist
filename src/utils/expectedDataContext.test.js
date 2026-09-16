// expectedDataContext.test.js — v4.117.0 request-memory arming.
import {
  armExpectedData,
  getArmedExpectedType,
  clearExpectedData,
  EXPECTED_WINDOW_MS,
} from './expectedDataContext';

describe('expectedDataContext (v4.117.0)', () => {
  beforeEach(() => {
    clearExpectedData();
  });

  test('EN phone request arms phone', () => {
    expect(armExpectedData('can I have your phone number', {}).type).toBe('phone');
    expect(getArmedExpectedType()).toBe('phone');
  });

  test('EN SSN request arms ssn', () => {
    armExpectedData('what is your social', {});
    expect(getArmedExpectedType()).toBe('ssn');
  });

  test('insurance IDs arm ID grouping (member lane)', () => {
    armExpectedData('there is the affiliate number', {});
    expect(getArmedExpectedType()).toBe('member');
    armExpectedData('viene el número de afiliado', {});
    expect(['ssn', 'member']).toContain(getArmedExpectedType());
  });

  test('DOB/address requests arm their type', () => {
    armExpectedData('what is your date of birth', {});
    expect(getArmedExpectedType()).toBe('dob');
    armExpectedData('where do you live', {});
    expect(getArmedExpectedType()).toBe('address');
  });

  test('ES requests arm (número, seguro, nacimiento)', () => {
    armExpectedData('me puede dar su número de teléfono', {});
    expect(getArmedExpectedType()).toBe('phone');
    armExpectedData('cuál es su seguro social', {});
    expect(getArmedExpectedType()).toBe('ssn');
    armExpectedData('cuál es su fecha de nacimiento', {});
    expect(getArmedExpectedType()).toBe('dob');
  });

  test('digit bubbles do not clear or change the arm', () => {
    armExpectedData('can I have your phone number', {});
    armExpectedData('5 5 5 1 2 3 4', {});
    expect(getArmedExpectedType()).toBe('phone');
  });

  test('re-arm replaces the type', () => {
    armExpectedData('can I have your phone number', { now: 1000 });
    armExpectedData('what is your social', { now: 2000 });
    expect(getArmedExpectedType({ now: 3000 })).toBe('ssn');
  });

  test('expires after the window', () => {
    armExpectedData('can I have your phone number', { now: 1000 });
    expect(getArmedExpectedType({ now: 1000 + EXPECTED_WINDOW_MS - 1 })).toBe('phone');
    expect(getArmedExpectedType({ now: 1000 + EXPECTED_WINDOW_MS + 1 })).toBeNull();
  });

  test('neutral text arms nothing', () => {
    armExpectedData('the patient feels fine', {});
    expect(getArmedExpectedType()).toBeNull();
  });
});
