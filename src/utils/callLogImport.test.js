import { parseCallLogText, groupCallsByDay, mergeImportedDays } from './callLogImport';

const SAMPLE = [
  'Customer ID\tCall Date\tCall Start\tDuration (Minutes)\tBillable\tDropped\tPay',
  '1178\t09/08/2026\t09:35 AM\t10\tYes\tNo\t$0.00',
  '91316\t09/08/2026\t09:02 AM\t13\tYes\tNo\t$0.00',
  '555\t09/07/2026\t05:10 PM\t30\tNo\tYes\t$0.00',
  'junk row',
].join('\n');

describe('callLogImport', () => {
  test('parses TSV with header, flags junk', () => {
    const { calls, skipped } = parseCallLogText(SAMPLE);
    expect(calls).toHaveLength(3);
    expect(skipped).toBe(1);
    expect(calls[0].customerId).toBe('555'); // sorted by start (09/07 first)
    expect(calls[0].billable).toBe(false);
    expect(calls[1].customerId).toBe('91316');
    expect(calls[1].billable).toBe(true);
    expect(calls[0].dropped).toBe(true);
  });

  test('parses space-separated paste (no tabs, header with spaces)', () => {
    const pasted = [
      'Customer ID Call Date Call Start Duration (Minutes) Billable Dropped Pay',
      '10615 09/08/2026 10:41 AM 29 Yes No $0.00',
      '94062 09/08/2026 10:29 AM 7 Yes No $0.00',
      '1178 09/08/2026 09:35 AM 10 Yes No $0.00',
      '91316 09/08/2026 09:02 AM 13 Yes No $0.00',
    ].join('\n');
    const { calls, skipped } = parseCallLogText(pasted);
    expect(skipped).toBe(0);
    expect(calls).toHaveLength(4);
    const days = groupCallsByDay(calls);
    expect(days).toHaveLength(1);
    expect(days[0].billableMins).toBe(59);
    expect(days[0].billableCalls).toBe(4);
  });

  test('parses CSV too', () => {
    const { calls } = parseCallLogText('Customer ID,Call Date,Call Start,Duration (Minutes),Billable,Dropped,Pay\n1,09/08/2026,09:35 AM,10,Yes,No,$0.00');
    expect(calls).toHaveLength(1);
    expect(calls[0].mins).toBe(10);
  });

  test('parses one-field-per-line paste (client app list copy)', () => {
    const pasted = [
      '91836', '09/08/2026', '12:17 PM', '19', 'Yes', 'No', '$0.00',
      '7074', '09/08/2026', '12:03 PM', '7', 'Yes', 'No', '$0.00',
      '70905', '09/08/2026', '11:16 AM', '4', 'Yes', 'No', '$0.00',
      '10615', '09/08/2026', '10:41 AM', '29', 'Yes', 'No', '$0.00',
      '94062', '09/08/2026', '10:29 AM', '7', 'Yes', 'No', '$0.00',
      '1178', '09/08/2026', '09:35 AM', '10', 'Yes', 'No', '$0.00',
      '91316', '09/08/2026', '09:02 AM', '13', 'Yes', 'No', '$0.00',
    ].join('\n');
    const { calls, skipped } = parseCallLogText(pasted);
    expect(skipped).toBe(0);
    expect(calls).toHaveLength(7);
    expect(calls[0].customerId).toBe('91316'); // sorted by start
    const days = groupCallsByDay(calls);
    expect(days).toHaveLength(1);
    expect(days[0].billableMins).toBe(89);
    expect(days[0].billableCalls).toBe(7);
  });

  test('parses one-field-per-line paste with NBSP + CR endings (client app copy)', () => {
    const nbsp = '\u00A0';
    const pasted = [
      '91836', '09/08/2026' + nbsp, nbsp + '12:17' + nbsp + 'PM', '19', 'Yes', 'No', '$0.00',
      '7074', '09/08/2026', '12:03 PM', '7', 'Yes', 'No', '$0.00',
    ].join('\r');
    const { calls, skipped, skippedSamples } = parseCallLogText(pasted);
    expect(skipped).toBe(0);
    expect(calls).toHaveLength(2);
    expect(skippedSamples).toEqual([]);
    expect(calls[0].customerId).toBe('7074'); // 12:03 PM sorts before 12:17 PM
    expect(calls.find((c) => c.customerId === '91836').mins).toBe(19);
  });

  test('12h edge cases: 12 AM vs 12 PM', () => {
    const { calls } = parseCallLogText('1,09/08/2026,12:05 AM,5,Yes,No,$0\n2,09/08/2026,12:05 PM,5,Yes,No,$0');
    expect(new Date(calls[0].startMs).getHours()).toBe(0);
    expect(new Date(calls[1].startMs).getHours()).toBe(12);
  });

  test('groups by day with billable-only mins + off estimate', () => {
    const { calls } = parseCallLogText(SAMPLE);
    const days = groupCallsByDay(calls);
    expect(days).toHaveLength(2);
    const sep8 = days.find((d) => d.dateStr === new Date(2026, 8, 8).toDateString());
    expect(sep8.billableMins).toBe(23);
    expect(sep8.billableCalls).toBe(2);
    expect(sep8.offMinsEstimate).toBe(540 - 23);
    expect(sep8.segments).toHaveLength(2);
    const sep7 = days.find((d) => d.dateStr === new Date(2026, 8, 7).toDateString());
    expect(sep7.billableMins).toBe(0);
    expect(sep7.segments).toHaveLength(1); // dropped still occupied time
  });

  test('merge overwrites past days, deltas monthly, corrects today', () => {
    const { calls } = parseCallLogText(SAMPLE);
    const days = groupCallsByDay(calls);
    const todayStr = new Date(2026, 8, 8).toDateString();
    const out = mergeImportedDays({
      dailyLog: { [new Date(2026, 8, 7).toDateString()]: 5 },
      historyTimeline: {},
      stats: { dailyMinutes: 0, monthlyMinutes: 100, weeklyMinutes: 50, callsToday: 0, dayStartTime: null },
      days,
      todayStr,
      currentMonthKey: '2026-8',
    });
    // Past day overwritten (was 5), monthly gets delta only (+0-5 => -5)
    expect(out.dailyLog[new Date(2026, 8, 7).toDateString()]).toBe(0);
    // Today: import is authoritative, monthly/weekly absorb the signed delta (+23)
    expect(out.stats.monthlyMinutes).toBe(118);
    expect(out.stats.weeklyMinutes).toBe(68);
    expect(out.stats.dailyMinutes).toBe(23);
    expect(out.stats.callsToday).toBe(2);
    expect(out.stats.dayStartTime).toBe(days.find((d) => d.dateStr === todayStr).firstStartMs);
    // Today now also lands in dailyLog + timeline so the progress bar repaints
    expect(out.dailyLog[todayStr]).toBe(23);
    expect(out.historyTimeline[todayStr].length).toBeGreaterThan(0);
    expect(out.summary.todayOld).toBe(0);
    expect(out.summary.todayNew).toBe(23);
    // Re-import is idempotent on monthly (delta 0 second time)
    const again = mergeImportedDays({ ...out, days, todayStr, currentMonthKey: '2026-8' });
    expect(again.stats.monthlyMinutes).toBe(118);
    expect(again.stats.dailyMinutes).toBe(23);
    // Correction may go DOWN: over-banked minutes get pulled back, monthly follows
    const down = mergeImportedDays({
      ...out, stats: { ...out.stats, dailyMinutes: 40, callsToday: 6, monthlyMinutes: 135, weeklyMinutes: 85 },
      days, todayStr, currentMonthKey: '2026-8',
    });
    expect(down.stats.dailyMinutes).toBe(23);
    expect(down.stats.callsToday).toBe(2);
    expect(down.stats.monthlyMinutes).toBe(118); // 135 - 17
    expect(down.stats.weeklyMinutes).toBe(68); // 85 - 17
  });

  // v4.133.2 regression: whole-month paste (~219 calls). Proves the Settings →
  // Data import panel can take a full month in one shot and the goal tracker
  // stays consistent (monthly == Σ dailyLog + today, re-import idempotent).
  test('whole-month import: 219 calls, overwrite + goal-view consistency', () => {
    const pad = (n) => String(n).padStart(2, '0');
    const text = [
      'Customer ID\tCall Date\tCall Start\tDuration (Minutes)\tBillable\tDropped\tPay',
      ...Array.from({ length: 219 }, (_, i) => {
        const day = (i % 19) + 1; // Sep 01..19 (2026), every day gets calls
        const h24 = 9 + (Math.floor(i / 19) % 8); // 09:00..16:59 starts
        const mins = 5 + (i % 25);
        const billable = i % 9 !== 8 ? 'Yes' : 'No';
        return `${9000 + i}\t09/${pad(day)}/2026\t${pad(h24 % 12 || 12)}:${pad((i * 7) % 60)} ${h24 < 12 ? 'AM' : 'PM'}\t${mins}\t${billable}\tNo\t$0.00`;
      }),
    ].join('\n');
    const { calls, skipped } = parseCallLogText(text);
    expect(calls).toHaveLength(219);
    expect(skipped).toBe(0);
    const days = groupCallsByDay(calls);
    expect(days).toHaveLength(19); // every day of the month so far

    const todayStr = new Date(2026, 8, 19).toDateString();
    const expectedMins = calls.filter((c) => c.billable).reduce((s, c) => s + c.mins, 0);
    // Hand-tracked junk from before the import (overwritten, not double-counted).
    const preLog = {
      [new Date(2026, 8, 1).toDateString()]: 999,
      [new Date(2026, 8, 2).toDateString()]: 999,
      [new Date(2026, 8, 3).toDateString()]: 999,
    };
    const out = mergeImportedDays({
      dailyLog: preLog,
      historyTimeline: {},
      stats: { dailyMinutes: 0, monthlyMinutes: 2997, weeklyMinutes: 2997, callsToday: 0 },
      days,
      todayStr,
      currentMonthKey: '2026-8',
    });
    expect(out.summary.totalCalls).toBe(calls.filter((c) => c.billable).length);
    // Monthly lands exactly on the company billable total (deltas cancel the 999s).
    expect(out.stats.monthlyMinutes).toBe(expectedMins);
    // Goal-view invariant: resync preview (Σ past dailyLog + today) == monthly.
    const resync = Object.entries(out.dailyLog)
      .reduce((s, [k, v]) => (k === todayStr ? s : s + v), 0) + out.stats.dailyMinutes;
    expect(resync).toBe(out.stats.monthlyMinutes);
    expect(out.historyTimeline[todayStr].length).toBeGreaterThan(0);
    // Re-pasting the whole month is a no-op (idempotent deltas).
    const again = mergeImportedDays({ ...out, days, todayStr, currentMonthKey: '2026-8' });
    expect(again.stats.monthlyMinutes).toBe(expectedMins);
    expect(again.stats.dailyMinutes).toBe(out.stats.dailyMinutes);
  });

  test('whole-month vertical paste (client app list copy) parses all records', () => {
    const pad = (n) => String(n).padStart(2, '0');
    const lines = Array.from({ length: 219 }, (_, i) => {
      const day = (i % 19) + 1;
      const mins = 5 + (i % 25);
      return [9000 + i, `09/${pad(day)}/2026`, '10:00 AM', mins, 'Yes', 'No', '$0.00'].join('\n');
    }).join('\n');
    const { calls, skipped } = parseCallLogText(lines);
    expect(skipped).toBe(0);
    expect(calls).toHaveLength(219);
  });
});
