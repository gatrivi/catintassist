import {
  parseCallLogText,
  groupCallsByDay,
  mergeImportedDays,
  diffDaysAgainstStored,
  summarizeDiff,
  buildUndoSnapshot,
  applyUndoSnapshot,
} from './callLogImport';

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

// v4.160.0 — the Settings → Today panel. The operator's real problem: they keep
// transcription running past the end of a call, so the app banks minutes that
// the company log does not. The panel must SHOW that change before writing it
// and be able to take it back.
describe('callLogImport v4.160.0 — preview + undo', () => {
  const todayStr = new Date(2026, 8, 8).toDateString();
  const sep7 = new Date(2026, 8, 7).toDateString();
  const TODAY_ROWS = ['1178\t09/08/2026\t09:35 AM\t10\tYes\tNo\t$0.00', '91316\t09/08/2026\t09:02 AM\t13\tYes\tNo\t$0.00'].join('\n');
  const todayDays = () => groupCallsByDay(parseCallLogText(TODAY_ROWS).calls);

  test('diff reads TODAY from the live counter, not dailyLog', () => {
    // dailyLog is only written at endDay/rollover — mid-day it is empty while
    // the scoreboard shows 84m. The diff must compare against the 84.
    const rows = diffDaysAgainstStored({
      days: todayDays(),
      dailyLog: {},
      todayMinutes: 84,
      todayStr,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].isToday).toBe(true);
    expect(rows[0].storedMins).toBe(84);
    expect(rows[0].newMins).toBe(23);
    expect(rows[0].delta).toBe(-61); // the "I forgot to hit stop" case
    expect(rows[0].overwrites).toBe(true);
  });

  test('diff flags up, down, unchanged and no-stored-data', () => {
    const days = groupCallsByDay(parseCallLogText([
      '1\t09/08/2026\t09:35 AM\t10\tYes\tNo\t$0', // today, 10m
      '2\t09/07/2026\t09:35 AM\t30\tYes\tNo\t$0', // past, 30m
      '3\t09/06/2026\t09:35 AM\t40\tYes\tNo\t$0', // past, 40m
    ].join('\n')).calls);
    const rows = diffDaysAgainstStored({
      days,
      dailyLog: { [sep7]: 20, [new Date(2026, 8, 6).toDateString()]: 40 },
      todayMinutes: 10,
      todayStr,
    });
    // today first, then newest day first
    expect(rows.map((r) => r.isToday ? 'today' : r.dateStr)).toEqual([
      'today', sep7, new Date(2026, 8, 6).toDateString(),
    ]);
    expect(rows[0].delta).toBe(0); // today matches
    expect(rows[1].delta).toBe(10); // past day goes up
    expect(rows[2].delta).toBe(0); // past day unchanged
    expect(rows[2].overwrites).toBe(true);
    expect(summarizeDiff(rows)).toMatchObject({ days: 3, changedDays: 1, upMins: 10, downMins: 0 });
  });

  test('diff never throws on an empty or junk paste', () => {
    expect(diffDaysAgainstStored()).toEqual([]);
    expect(diffDaysAgainstStored({ days: null, dailyLog: null })).toEqual([]);
    expect(summarizeDiff(null)).toMatchObject({ days: 0, changedDays: 0 });
  });

  test('undo restores an over-banked day exactly (apply -> undo == original)', () => {
    const original = {
      dailyLog: { [sep7]: 5 },
      historyTimeline: { [sep7]: [{ type: 'work', start: 1, end: 2 }] },
      stats: { dailyMinutes: 84, monthlyMinutes: 900, weeklyMinutes: 300, callsToday: 9 },
    };
    const days = todayDays();
    const merged = mergeImportedDays({ ...original, days, todayStr, currentMonthKey: '2026-8' });
    // The paste really moved the numbers.
    expect(merged.stats.dailyMinutes).toBe(23);
    expect(merged.stats.callsToday).toBe(2);
    expect(merged.stats.monthlyMinutes).toBe(839);

    const snap = buildUndoSnapshot({ ...original, days, summary: merged.summary });
    expect(snap.touched).toEqual([todayStr]);
    const back = applyUndoSnapshot({ ...merged, snapshot: snap });
    expect(back.restored).toBe(true);
    expect(back.stats).toEqual(original.stats);
    expect(back.dailyLog).toEqual(original.dailyLog);
    expect(back.historyTimeline).toEqual(original.historyTimeline);
  });

  test('undo deletes a day that did not exist before the paste', () => {
    const original = { dailyLog: {}, historyTimeline: {}, stats: { dailyMinutes: 0, monthlyMinutes: 0 } };
    const days = groupCallsByDay(parseCallLogText('5\t09/07/2026\t10:00 AM\t25\tYes\tNo\t$0').calls);
    const merged = mergeImportedDays({ ...original, days, todayStr: sep7, currentMonthKey: '2026-8' });
    expect(merged.dailyLog[sep7]).toBe(25);
    const back = applyUndoSnapshot({ ...merged, snapshot: buildUndoSnapshot({ ...original, days }) });
    expect(back.restored).toBe(true);
    expect(back.dailyLog[sep7]).toBeUndefined(); // not 0 — gone
    expect(sep7 in back.dailyLog).toBe(false);
  });

  test('undo is a no-op without a snapshot (never corrupts state)', () => {
    const cur = { dailyLog: { a: 1 }, historyTimeline: {}, stats: { dailyMinutes: 3 } };
    expect(applyUndoSnapshot({ ...cur, snapshot: null })).toMatchObject({ ...cur, restored: false });
    expect(applyUndoSnapshot({ ...cur, snapshot: { touched: [] } })).toMatchObject({ ...cur, restored: false });
  });

  test('undo only touches the days the paste touched', () => {
    const days = todayDays();
    const original = {
      dailyLog: { [sep7]: 5, [todayStr]: 84 },
      historyTimeline: {},
      stats: { dailyMinutes: 84, monthlyMinutes: 900 },
    };
    const merged = mergeImportedDays({ ...original, days, todayStr, currentMonthKey: '2026-8' });
    merged.dailyLog[sep7] = 77; // an unrelated edit after the paste
    const back = applyUndoSnapshot({ ...merged, snapshot: buildUndoSnapshot({ ...original, days }) });
    expect(back.dailyLog[sep7]).toBe(77); // untouched by the undo
    expect(back.dailyLog[todayStr]).toBe(84);
  });
});
