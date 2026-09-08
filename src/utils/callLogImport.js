/**
 * Company call-log paste import (v4.87.0).
 *
 * The client platform exports rows like:
 *   Customer ID | Call Date | Call Start | Duration (Minutes) | Billable | Dropped | Pay
 *   1178        | 09/08/2026| 09:35 AM   | 10                 | Yes      | No      | $0.00
 *
 * Paste may be TSV (spreadsheet copy), CSV, one-record-per-line (spaces), or
 * one-field-per-line (client app list copy). This module is pure:
 * parse pasted text -> per-day summaries -> merge into app state.
 * Company log is source of truth: import OVERWRITES stored per-day totals.
 */

export const SHIFT_START_HOUR = 9;
export const SHIFT_END_HOUR = 18;
export const SHIFT_WINDOW_MINS = (SHIFT_END_HOUR - SHIFT_START_HOUR) * 60; // 540

const splitRow = (line, delim) => {
  if (delim !== ',') return line.split('\t').map((c) => c.trim());
  // Minimal quote-aware CSV split (Pay may contain "$1,234.00").
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i += 1; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
};

const isHeaderRow = (cells) => /customer|call date|duration|billable/i.test(cells.join(' '));

const parseDateTime = (dateStr, timeStr) => {
  // MM/DD/YYYY + "hh:mm AM/PM" (local time).
  const dm = String(dateStr || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const tm = String(timeStr || '').match(/(\d{1,2}):(\d{2})\s*([AaPp])\.?\s*[Mm]?\.?/);
  if (!dm || !tm) return null;
  let h = Number(tm[1]) % 12;
  if (/p/i.test(tm[3])) h += 12;
  const d = new Date(Number(dm[3]), Number(dm[1]) - 1, Number(dm[2]), h, Number(tm[2]), 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

const isYes = (v) => /^\s*(y(es)?|true|1)\s*$/i.test(String(v || ''));

/**
 * Fallback for plain space-separated paste (chat/monitor copy with no tabs):
 *   10615 09/08/2026 10:41 AM 29 Yes No $0.00
 * Customer ID has no spaces; Call Start may be "10:41 AM" (two tokens).
 */
const parseSpaceRow = (line) => {
  const toks = String(line || '').trim().split(/\s+/);
  const dateIdx = toks.findIndex((t) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t));
  if (dateIdx < 0) return null;
  const dateStr = toks[dateIdx];
  let startStr = toks[dateIdx + 1] || '';
  let restIdx = dateIdx + 2;
  // "10:41 AM" split across two tokens — rejoin the AM/PM marker.
  if (/^[AaPp]\.?[Mm]?\.?$/.test(toks[dateIdx + 2] || '') && /:/.test(startStr)) {
    startStr = `${startStr} ${toks[dateIdx + 2]}`;
    restIdx = dateIdx + 3;
  }
  const [durStr, billableStr, droppedStr] = [toks[restIdx], toks[restIdx + 1], toks[restIdx + 2]];
  const startMs = parseDateTime(dateStr, startStr);
  const mins = Number.parseFloat(durStr);
  if (startMs === null || !Number.isFinite(mins) || mins < 0) return null;
  return {
    customerId: toks.slice(0, dateIdx).join(' ') || '',
    startMs,
    endMs: startMs + Math.round(mins * 60000),
    mins,
    billable: isYes(billableStr),
    dropped: isYes(droppedStr),
  };
};

/**
 * Vertical paste: each field on its own line (copy from the client app list) —
 *   91836 / 09/08/2026 / 12:17 PM / 19 / Yes / No / $0.00 / (next record...)
 * Regroups lines into one space-separated record string per call.
 * A record closes on a money token ("$0.00") or when a new date line arrives
 * after a full buffer (>=6 fields) — covers missing Pay values.
 */
const isDateTok = (t) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t);
const isMoneyTok = (t) => /^\$\d/.test(t);
const groupVerticalRecords = (lines) => {
  if (!lines.some(isDateTok)) return null; // not vertical format
  const records = [];
  let buf = [];
  lines.forEach((l) => {
    if (isDateTok(l) && buf.length >= 6) { records.push(buf.join(' ')); buf = []; }
    buf.push(l);
    if (isMoneyTok(l)) { records.push(buf.join(' ')); buf = []; }
  });
  if (buf.length) records.push(buf.join(' '));
  return records;
};

/** Parse pasted text -> { calls, skipped, total }. calls: billable-aware, sorted by start. */
export const parseCallLogText = (text) => {
  let lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { calls: [], skipped: 0, total: 0 };
  const hasTabs = lines.some((l) => l.includes('\t'));
  // Only treat commas as delimiters when a line actually has 4+ comma fields
  // (otherwise Pay "$0.00" or prose trips the CSV path and spaces never parse).
  const hasCsv = !hasTabs && lines.some((l) => l.split(',').length >= 4);
  const delim = hasTabs ? '\t' : hasCsv ? ',' : null;
  if (!delim) {
    // One-field-per-line paste: regroup into record strings first.
    const vertical = groupVerticalRecords(lines);
    if (vertical) lines = vertical;
  }
  const calls = [];
  let skipped = 0;
  lines.forEach((line, idx) => {
    if (delim) {
      const cells = splitRow(line, delim);
      if (idx === 0 && isHeaderRow(cells)) return;
      if (cells.length >= 4) {
        const [customerId, dateStr, startStr, durStr, billableStr, droppedStr] = cells;
        const startMs = parseDateTime(dateStr, startStr);
        const mins = Number.parseFloat(durStr);
        if (startMs !== null && Number.isFinite(mins) && mins >= 0) {
          calls.push({
            customerId: customerId || '',
            startMs,
            endMs: startMs + Math.round(mins * 60000),
            mins,
            billable: isYes(billableStr),
            dropped: isYes(droppedStr),
          });
          return;
        }
      }
      // Delimited parse failed — fall through to the space-separated fallback.
    } else if (idx === 0 && isHeaderRow([line])) {
      return;
    }
    // Header with spaces ("Customer ID Call Date ...") has no date token.
    if (/customer/i.test(line) && /duration|billable/i.test(line)) return;
    const row = parseSpaceRow(line);
    if (row) calls.push(row);
    else skipped += 1;
  });
  calls.sort((a, b) => a.startMs - b.startMs);
  return { calls, skipped, total: lines.length };
};

const fmtTime = (ms) => {
  const d = new Date(ms);
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
};

/** Group calls -> per-day summaries keyed for dailyLog/historyTimeline. */
export const groupCallsByDay = (calls) => {
  const map = new Map();
  calls.forEach((c) => {
    const dateStr = new Date(c.startMs).toDateString();
    if (!map.has(dateStr)) {
      map.set(dateStr, {
        dateStr,
        calls: 0,
        billableCalls: 0,
        billableMins: 0,
        totalMins: 0,
        firstStartMs: c.startMs,
        lastEndMs: c.endMs,
        segments: [],
      });
    }
    const day = map.get(dateStr);
    day.calls += 1;
    day.totalMins += c.mins;
    if (c.billable) { day.billableCalls += 1; day.billableMins += c.mins; }
    day.firstStartMs = Math.min(day.firstStartMs, c.startMs);
    day.lastEndMs = Math.max(day.lastEndMs, c.endMs);
    day.segments.push({ type: 'work', start: c.startMs, end: c.endMs });
  });
  return [...map.values()].map((d) => ({
    ...d,
    billableMins: Math.round(d.billableMins),
    totalMins: Math.round(d.totalMins),
    firstStart: fmtTime(d.firstStartMs),
    lastEnd: fmtTime(d.lastEndMs),
    // Off-time estimate inside the 9:00-18:00 window (breaks + avail, not tracked by company).
    offMinsEstimate: Math.max(0, SHIFT_WINDOW_MINS - Math.round(d.billableMins)),
  }));
};

/**
 * Merge day summaries into stored state. Pure — returns fresh objects.
 * - Past days: OVERWRITE dailyLog + historyTimeline; monthly/weekly get the DELTA
 *   (so re-imports never double-count).
 * - Today: imported values are AUTHORITATIVE for stats.dailyMinutes/callsToday
 *   (import is the correction tool — can go up or down). Monthly/weekly get the
 *   signed delta. Today is also written to dailyLog/historyTimeline so the
 *   progress-bar timeline repaints.
 * - dayStartTime fills from first call only when unset (drives lateness/shift math).
 */
export const mergeImportedDays = ({
  dailyLog = {},
  historyTimeline = {},
  stats = {},
  days = [],
  todayStr = new Date().toDateString(),
  currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`,
} = {}) => {
  const nextLog = { ...dailyLog };
  const nextHistory = { ...historyTimeline };
  const nextStats = { ...stats };
  let totalMins = 0;
  let totalCalls = 0;
  let todayOld = null;
  let todayNew = null;
  days.forEach((d) => {
    totalMins += d.billableMins;
    totalCalls += d.billableCalls;
    if (d.dateStr === todayStr) {
      // Today: import overwrites (correction may go down). Re-import of the
      // same rows is still a no-op (delta 0).
      const prevDaily = Number(nextStats.dailyMinutes) || 0;
      todayOld = prevDaily;
      todayNew = d.billableMins;
      const delta = d.billableMins - prevDaily;
      nextStats.dailyMinutes = d.billableMins;
      nextStats.callsToday = d.billableCalls;
      const dayDate = new Date(d.firstStartMs);
      const dayMonthKey = `${dayDate.getFullYear()}-${dayDate.getMonth()}`;
      if (dayMonthKey === currentMonthKey) {
        nextStats.monthlyMinutes = Math.max(0, (nextStats.monthlyMinutes || 0) + delta);
        nextStats.weeklyMinutes = Math.max(0, (nextStats.weeklyMinutes || 0) + delta);
      }
      if (!nextStats.dayStartTime) nextStats.dayStartTime = d.firstStartMs;
      // Write today's segments too so the timeline repaints.
      nextLog[d.dateStr] = d.billableMins;
      nextHistory[d.dateStr] = d.segments.map((s) => ({ ...s }));
      return;
    }
    const old = Number(nextLog[d.dateStr] || 0);
    nextLog[d.dateStr] = d.billableMins;
    nextHistory[d.dateStr] = d.segments.map((s) => ({ ...s }));
    const dayDate = new Date(d.firstStartMs);
    const dayMonthKey = `${dayDate.getFullYear()}-${dayDate.getMonth()}`;
    if (dayMonthKey === currentMonthKey) {
      const delta = d.billableMins - old;
      nextStats.monthlyMinutes = (nextStats.monthlyMinutes || 0) + delta;
      nextStats.weeklyMinutes = (nextStats.weeklyMinutes || 0) + delta;
    }
  });
  return {
    dailyLog: nextLog,
    historyTimeline: nextHistory,
    stats: nextStats,
    summary: { days: days.length, totalMins, totalCalls, todayOld, todayNew },
  };
};
