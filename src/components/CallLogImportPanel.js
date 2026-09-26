import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import {
  parseCallLogText,
  groupCallsByDay,
  diffDaysAgainstStored,
  summarizeDiff,
  CALLLOG_UNDO_KEY,
} from '../utils/callLogImport';
import { APP_VERSION_LABEL } from '../constants/version';

/** Human "when did that happen" for the undo line. */
const ago = (ms) => {
  const s = Math.max(0, Math.round((Date.now() - Number(ms || 0)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

/**
 * Settings → Today: paste the company call rows to correct the day.
 *
 * v4.160.0 — this is the most-used control in the app, so it shows the
 * stored -> new change per day BEFORE anything is written, keeps the paste
 * (so a bad preview can be fixed without re-copying), and offers a one-tap
 * undo of the last import. Company log is source of truth.
 */
export function CallLogImportPanel() {
  const { importCallLog, undoCallLogImport, dailyLog, stats } = useSession();
  const [paste, setPaste] = useState('');
  const [todayOnly, setTodayOnly] = useState(true);
  const [status, setStatus] = useState(null); // { tone, text }
  const [confirming, setConfirming] = useState(false);
  const [undoInfo, setUndoInfo] = useState(null); // { savedAt, summary }

  const todayStr = useMemo(() => new Date().toDateString(), []);
  const todayMinutes = stats?.dailyMinutes || 0;

  const parsed = useMemo(() => {
    if (!paste.trim()) return null;
    const { calls, skipped, skippedSamples } = parseCallLogText(paste);
    const allDays = groupCallsByDay(calls);
    const days = todayOnly ? allDays.filter((d) => d.dateStr === todayStr) : allDays;
    const rows = diffDaysAgainstStored({ days, dailyLog, todayMinutes, todayStr });
    return { rows, days, allDayCount: allDays.length, skipped, skippedSamples };
  }, [paste, todayOnly, dailyLog, todayMinutes, todayStr]);

  // An undo survives a reload — offer it as soon as a snapshot exists.
  useEffect(() => {
    let snap = null;
    try {
      snap = JSON.parse(localStorage.getItem(CALLLOG_UNDO_KEY) || 'null');
    } catch { snap = null; }
    if (snap?.touched?.length) {
      setUndoInfo({ savedAt: snap.savedAt, summary: snap.summary });
    }
  }, []);

  const flash = useCallback((tone, text) => setStatus({ tone, text }), []);

  const readClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) {
        flash('warn', 'Clipboard is empty.');
        return;
      }
      setPaste(text);
      setConfirming(false);
      flash('ok', 'Pasted from clipboard — check the preview below.');
    } catch {
      flash('warn', 'Clipboard blocked by the browser — click the box and press Ctrl+V / ⌘V.');
    }
  }, [flash]);

  const handleApply = () => {
    const rows = parsed?.rows || [];
    if (!rows.length) return;
    const sum = summarizeDiff(rows);
    if (!sum.changedDays) {
      flash('warn', 'Nothing to change — pasted minutes already match the app.');
      return;
    }
    // Second click confirms. No native dialog: an interruption you cannot
    // miss, and no "are you sure?" dialog covering the numbers.
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const days = parsed.days;
    const s = importCallLog(days);
    setConfirming(false);
    const todayNote = s.todayNew != null && s.todayOld != null && s.todayOld !== s.todayNew
      ? ` Today ${s.todayOld}m → ${s.todayNew}m.`
      : '';
    flash('ok', `Applied ${s.days} day(s) · ${s.totalCalls} calls · ${s.totalMins}m.${todayNote}`);
    try {
      const snap = JSON.parse(localStorage.getItem(CALLLOG_UNDO_KEY) || 'null');
      if (snap) setUndoInfo({ savedAt: snap.savedAt, summary: snap.summary });
    } catch { /* no undo info, apply still succeeded */ }
  };

  const handleUndo = () => {
    const undone = undoCallLogImport();
    if (!undone) {
      flash('warn', 'Nothing left to undo.');
      setUndoInfo(null);
      return;
    }
    setUndoInfo(null);
    setConfirming(false);
    flash('ok', `Undone — back to the minutes before the last paste.`);
  };

  const sum = parsed ? summarizeDiff(parsed.rows) : null;
  const noRows = parsed && parsed.rows.length === 0;

  return (
    <div id="settings-data-import" className="paste-panel">
      <p className="paste-panel-hint">
        Paste the client app&apos;s call rows. Company numbers overwrite what the app
        counted — scoreboard, progress bar and monthly total all follow. Preview first.
      </p>

      <div className="paste-panel-bar">
        <button type="button" className="btn btn--primary" onClick={readClipboard}>
          ⧉ Paste from clipboard
        </button>
        <label className="paste-panel-check">
          <input
            type="checkbox"
            checked={todayOnly}
            onChange={(e) => { setTodayOnly(e.target.checked); setConfirming(false); }}
            style={{ margin: 0 }}
          />
          Today only
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => { setPaste(''); setConfirming(false); setStatus(null); }}
          disabled={!paste}
        >
          ✕ Clear
        </button>
      </div>

      <textarea
        value={paste}
        onChange={(e) => { setPaste(e.target.value); setConfirming(false); }}
        rows={6}
        aria-label="Company call log rows to paste"
        placeholder={'Customer ID\tCall Date\tCall Start\tDuration (Minutes)\tBillable\tDropped\tPay\n1178\t09/08/2026\t09:35 AM\t10\tYes\tNo\t$0.00'}
        className="paste-panel-input"
      />

      {noRows && (
        <div className="paste-panel-err">
          No valid rows.
          {parsed.allDayCount > 0 && (
            <span> This paste has {parsed.allDayCount} other day(s) — untick “Today only”.</span>
          )}
        </div>
      )}

      {!!parsed?.rows.length && (
        <div className="paste-panel-rows">
          {parsed.rows.map((r) => (
            <div
              key={r.dateStr}
              className={`paste-row${r.isToday ? ' paste-row--today' : ''}${
                r.delta === 0 ? ' paste-row--same' : ''
              }`}
            >
              <div className="paste-row-head">
                {r.isToday && <span className="paste-row-today">TODAY</span>}
                <strong>{r.isToday ? 'Today' : r.dateStr}</strong>
                <span className="paste-row-mut">· {r.billableCalls}/{r.calls} calls · {r.firstStart}–{r.lastEnd}</span>
                <span className="paste-row-delta" data-dir={r.delta === 0 ? 'flat' : r.delta > 0 ? 'up' : 'down'}>
                  {r.storedMins}m → {r.newMins}m ({signed(r.delta)})
                </span>
              </div>
              <div className="paste-row-sub">
                <span className="paste-row-on">{r.billableMins}m on</span>
                <span className="paste-row-mut">· ~{r.offMinsEstimate}m off (9–18)</span>
                {r.overwrites && r.delta !== 0 && <span className="paste-row-warn">overwrites counted time</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {!!parsed?.skipped && (
        <details className="paste-panel-skipped">
          <summary>{parsed.skipped} row(s) not understood — ignored</summary>
          <ul>
            {parsed.skippedSamples.map((s, i) => <li key={i}><code>{s}</code></li>)}
          </ul>
        </details>
      )}

      {!!sum?.changedDays && (
        <div className="paste-panel-net">
          {sum.changedDays} of {sum.days} day(s) change
          {sum.downMins ? <span className="paste-row-delta" data-dir="down"> {signed(sum.downMins)}m</span> : null}
          {sum.upMins ? <span className="paste-row-delta" data-dir="up"> {signed(sum.upMins)}m</span> : null}
        </div>
      )}

      {status && <div className={`paste-panel-status is-${status.tone}`} role="status">{status.text}</div>}

      {confirming ? (
        <div className="paste-panel-confirm" role="alertdialog" aria-label="Confirm overwrite">
          <span>
            Overwrite {sum.changedDays} day(s)?
            {sum.downMins ? ` Removes ${Math.abs(sum.downMins)}m from the month.` : ''}
          </span>
          <button type="button" className="btn btn--danger" onClick={handleApply}>
            Yes, apply
          </button>
          <button type="button" className="btn" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="paste-panel-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleApply}
            disabled={!sum?.changedDays}
          >
            Apply to scoreboard
          </button>
          <span className="paste-panel-ver">{APP_VERSION_LABEL}</span>
        </div>
      )}

      {undoInfo && (
        <div className="paste-panel-undo">
          <span>
            Last paste: {undoInfo.summary?.totalMins}m over {undoInfo.summary?.days} day(s)
            {' · '}{ago(undoInfo.savedAt)}
          </span>
          <button type="button" className="btn btn--warn" onClick={handleUndo}>
            ↩ Undo last import
          </button>
        </div>
      )}
    </div>
  );
}
