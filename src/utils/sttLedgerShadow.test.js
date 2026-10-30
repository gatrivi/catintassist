import {
  LEDGER_SHADOW_KEY,
  readLedgerShadowSwitch,
  writeLedgerShadowSwitch,
} from './sttLedgerShadow';

describe('sttLedgerShadow switch', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('default is false when nothing in storage', () => {
    expect(readLedgerShadowSwitch()).toBe(false);
  });

  test('writeLedgerShadowSwitch writes 1 and read returns true', () => {
    expect(writeLedgerShadowSwitch(true)).toBe(true);
    expect(localStorage.getItem(LEDGER_SHADOW_KEY)).toBe('1');
    expect(readLedgerShadowSwitch()).toBe(true);
  });

  test('writeLedgerShadowSwitch writes 0 and read returns false', () => {
    writeLedgerShadowSwitch(true);
    expect(writeLedgerShadowSwitch(false)).toBe(false);
    expect(localStorage.getItem(LEDGER_SHADOW_KEY)).toBe('0');
    expect(readLedgerShadowSwitch()).toBe(false);
  });

  test('gracefully handles storage exceptions', () => {
    const origGet = localStorage.getItem;
    const origSet = localStorage.setItem;
    localStorage.getItem = () => { throw new Error('blocked'); };
    localStorage.setItem = () => { throw new Error('blocked'); };

    expect(readLedgerShadowSwitch()).toBe(false);
    expect(writeLedgerShadowSwitch(true)).toBe(true);

    localStorage.getItem = origGet;
    localStorage.setItem = origSet;
  });
});
