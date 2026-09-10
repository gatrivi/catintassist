/** THROWAWAY verification for exports/mls-import-sep2026 — delete after run. */
import fs from 'fs';
import path from 'path';
import { parseCallLogText, groupCallsByDay } from './callLogImport';

const rows = fs.readFileSync(
  path.join(__dirname, '..', '..', 'exports', 'mls-import-sep2026', 'call-log-paste.txt'),
  'utf8'
);

describe('MLS Sep 2026 paste block', () => {
  const parsed = parseCallLogText(rows);
  const days = groupCallsByDay(parsed.calls);

  it('parses every row (0 skipped)', () => {
    expect(parsed.skipped).toBe(0);
    expect(parsed.total).toBe(68); // 66 real + 2 filler
  });

  it('produces the 6 worked days', () => {
    expect(days.length).toBe(6);
  });

  it.each([
    // call counts for Sep 01/02 = captured rows (7+filler / 6+filler), NOT the
    // platform header chips (17 / 8) — those tables were scroll-truncated.
    // Minutes ARE exact (filler rows top up to the header totals).
    ['Sep 01', 181, 8],
    ['Sep 02', 69, 7],   // 69 billable (1 real non-billable min excluded)
    ['Sep 03', 193, 18],
    ['Sep 04', 202, 11],
    ['Sep 08', 179, 13],
    ['Sep 09', 157, 11],
  ])('%s totals match header', (label, mins, calls) => {
    const d = days.find((x) => x.dateStr.includes(label));
    expect(d).toBeTruthy();
    expect(d.billableMins).toBe(mins);
    expect(d.calls).toBe(calls);
  });
});
