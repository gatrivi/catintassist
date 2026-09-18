/**
 * v4.131.1: shift-slot picking must follow US Central, never the OS clock.
 *
 * Every instant below is a fixed UTC ISO string, so these assertions give the
 * same answer on a GMT-3 workstation and on a UTC CI box.
 */
import {
  WORK_TIMEZONE,
  TIME_SLOTS,
  SLOT_FALLBACK_ORDER,
  SLOT_OVERRIDE_KEY,
  getWorkHour,
  getWorkSlot,
  getSlotAuto,
  getWorkClockLabel,
  readSlotOverride,
  writeSlotOverride,
  nearestSlotOrder,
} from './workTime';

describe('workTime constants', () => {
  test('timezone and slot list are the shared single source', () => {
    expect(WORK_TIMEZONE).toBe('America/Chicago');
    expect(TIME_SLOTS).toEqual(['morning', 'afternoon', 'evening']);
  });
});

// The manual pick is persisted, so clear storage around every test: the
// pure-clock assertions below must never inherit a pick from an earlier one.
beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('getWorkSlot reads the Central clock', () => {
  // The reported production bug: 13:02 on a GMT-3 machine is 11:02 in Central
  // (CDT, UTC-5) — the MORNING opener is correct, the OS clock said afternoon.
  test('GMT-3 13:02 (= 11:02 CDT) is morning', () => {
    expect(getWorkSlot(new Date('2026-09-18T16:02:00Z'))).toBe('morning');
  });

  test('13:30 CDT is afternoon', () => {
    expect(getWorkSlot(new Date('2026-09-18T18:30:00Z'))).toBe('afternoon');
  });

  test('20:00 CDT is evening', () => {
    expect(getWorkSlot(new Date('2026-09-19T01:00:00Z'))).toBe('evening');
  });

  // Central midnight formats as hour "24" in some engines — must still clamp to 0.
  test('Central midnight is morning (hour 0, not 24)', () => {
    expect(getWorkHour(new Date('2026-09-18T05:00:00Z'))).toBe(0);
    expect(getWorkSlot(new Date('2026-09-18T05:00:00Z'))).toBe('morning');
  });
});

describe('slot boundaries are unchanged at 12:00 / 17:00 Central', () => {
  test('11:59 CDT is still morning', () => {
    expect(getWorkSlot(new Date('2026-09-18T16:59:00Z'))).toBe('morning');
  });

  test('12:00 CDT flips to afternoon', () => {
    expect(getWorkSlot(new Date('2026-09-18T17:00:00Z'))).toBe('afternoon');
  });

  test('16:59 CDT is still afternoon', () => {
    expect(getWorkSlot(new Date('2026-09-18T21:59:00Z'))).toBe('afternoon');
  });

  test('17:00 CDT flips to evening', () => {
    expect(getWorkSlot(new Date('2026-09-18T22:00:00Z'))).toBe('evening');
  });
});

describe('getWorkHour', () => {
  test('returns the Central hour, not the machine hour', () => {
    expect(getWorkHour(new Date('2026-09-18T16:02:00Z'))).toBe(11);
  });

  test('falls back to the machine clock when Intl is unavailable', () => {
    const spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no timezone data');
    });
    try {
      const d = new Date('2026-09-18T16:02:00Z');
      expect(getWorkHour(d)).toBe(d.getHours());
      expect(TIME_SLOTS).toContain(getWorkSlot(d));
    } finally {
      spy.mockRestore();
    }
  });
});

describe('getWorkClockLabel', () => {
  test('labels the fixed instant in Central time', () => {
    expect(getWorkClockLabel(new Date('2026-09-18T16:02:00Z'))).toBe('11:02 AM');
  });

  test('reads the same label whatever the machine timezone is', () => {
    // 22:00Z is 5:00 PM CDT — afternoon on the work clock either way.
    expect(getWorkClockLabel(new Date('2026-09-18T22:00:00Z'))).toBe('5:00 PM');
  });

  test('falls back to local formatting without throwing when Intl throws', () => {
    const spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no timezone data');
    });
    try {
      const d = new Date('2026-09-18T16:02:00Z');
      expect(getWorkClockLabel(d)).toBe(
        d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe('manual slot override (v4.131.1: the clock is only the default)', () => {
  // 13:30 CDT — the clock alone says afternoon, so an override proves the pick
  // outranks the clock (this is the whole point of the AM/PM/Eve buttons).
  const AFTERNOON_INSTANT = new Date('2026-09-18T18:30:00Z');

  test('nothing stored reads as "no override"', () => {
    expect(readSlotOverride()).toBeNull();
    expect(getWorkSlot(AFTERNOON_INSTANT)).toBe('afternoon');
  });

  test('the pick wins over the clock even when the clock says another slot', () => {
    writeSlotOverride('evening');
    expect(readSlotOverride()).toBe('evening');
    expect(getSlotAuto(AFTERNOON_INSTANT)).toBe('afternoon'); // clock unchanged
    expect(getWorkSlot(AFTERNOON_INSTANT)).toBe('evening');   // pick wins
  });

  test('every slot can be picked and round-trips through storage', () => {
    TIME_SLOTS.forEach((slot) => {
      writeSlotOverride(slot);
      expect(readSlotOverride()).toBe(slot);
      expect(getWorkSlot(AFTERNOON_INSTANT)).toBe(slot);
    });
  });

  test('the key is the documented one, holding the raw slot id', () => {
    writeSlotOverride('morning');
    expect(SLOT_OVERRIDE_KEY).toBe('catint_slot_override_v1');
    expect(localStorage.getItem(SLOT_OVERRIDE_KEY)).toBe('morning');
  });

  test('writeSlotOverride(null) clears the key and hands control back to the clock', () => {
    writeSlotOverride('morning');
    writeSlotOverride(null);
    expect(localStorage.getItem(SLOT_OVERRIDE_KEY)).toBeNull();
    expect(readSlotOverride()).toBeNull();
    expect(getWorkSlot(AFTERNOON_INSTANT)).toBe(getSlotAuto(AFTERNOON_INSTANT));
  });

  test('junk input clears the override instead of storing nonsense', () => {
    writeSlotOverride('morning');
    ['', 'Automatic', 'MORNING', 'x', 42, undefined, {}].forEach((junk) => {
      writeSlotOverride('morning'); // re-arm, so each junk value is really tested
      writeSlotOverride(junk);
      expect(localStorage.getItem(SLOT_OVERRIDE_KEY)).toBeNull();
      expect(getWorkSlot(AFTERNOON_INSTANT)).toBe('afternoon');
    });
  });

  test('junk already in storage reads as null (clock rule) and never throws', () => {
    localStorage.setItem(SLOT_OVERRIDE_KEY, 'afternoons');
    expect(readSlotOverride()).toBeNull();
    expect(getWorkSlot(AFTERNOON_INSTANT)).toBe('afternoon');
  });

  test('readSlotOverride returns null when localStorage throws', () => {
    writeSlotOverride('evening');
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    try {
      expect(readSlotOverride()).toBeNull();
      expect(getWorkSlot(AFTERNOON_INSTANT)).toBe('afternoon'); // clock rule
    } finally {
      spy.mockRestore();
    }
  });

  test('writeSlotOverride swallows a throwing localStorage', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      expect(() => writeSlotOverride('morning')).not.toThrow();
    } finally {
      spy.mockRestore();
    }
    expect(readSlotOverride()).toBeNull(); // nothing was written
  });

  test('removal failures are swallowed too (private mode)', () => {
    const spy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    try {
      expect(() => writeSlotOverride(null)).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('nearestSlotOrder', () => {
  test.each([
    ['morning', ['morning', 'afternoon', 'evening']],
    ['afternoon', ['afternoon', 'morning', 'evening']],
    ['evening', ['evening', 'afternoon', 'morning']],
  ])('%s tries itself first, then nearest', (slot, expected) => {
    expect(nearestSlotOrder(slot)).toEqual(expected);
  });

  test('falls back to the chronological list for an unknown slot', () => {
    expect(nearestSlotOrder('nonsense')).toEqual(['nonsense', ...TIME_SLOTS]);
  });

  test('every slot keeps all three slots reachable', () => {
    TIME_SLOTS.forEach((slot) => {
      expect([...nearestSlotOrder(slot)].sort()).toEqual([...TIME_SLOTS].sort());
    });
  });

  test('SLOT_FALLBACK_ORDER lists only known slots', () => {
    Object.values(SLOT_FALLBACK_ORDER).flat().forEach((s) => {
      expect(TIME_SLOTS).toContain(s);
    });
  });
});
