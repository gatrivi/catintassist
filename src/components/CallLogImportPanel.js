import React, { useMemo, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { parseCallLogText, groupCallsByDay } from '../utils/callLogImport';

/** Settings → Data: paste company call rows, preview per-day totals, apply to scoreboard. */
export function CallLogImportPanel() {
  const { importCallLog } = useSession();
  const [paste, setPaste] = useState('');
  const [status, setStatus] = useState('');

  const parsed = useMemo(() => {
    if (!paste.trim()) return null;
    const { calls, skipped } = parseCallLogText(paste);
    return { days: groupCallsByDay(calls), skipped };
  }, [paste]);

  const flash = (msg, ms = 5000) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), ms);
  };

  const handleApply = () => {
    if (!parsed || !parsed.days.length) return;
    const todayStr = new Date().toDateString();
    const overwrite = parsed.days.some((d) => {
      if (d.dateStr === todayStr) return false;
      try {
        return !!JSON.parse(localStorage.getItem('catintassist_daily_log') || '{}')[d.dateStr];
      } catch { return false; }
    });
    if (overwrite && !window.confirm('Some pasted days already have stored minutes. Overwrite with company numbers?')) return;
    const s = importCallLog(parsed.days);
    setPaste('');
    const todayNote = s.todayNew != null ? ` Today: ${s.todayOld}m → ${s.todayNew}m.` : '';
    flash(`Applied ${s.days} day(s) · ${s.totalCalls} billable calls · ${s.totalMins}m.${todayNote} (v4.87.4)`);
  };

  return (
    <div id="settings-data-import" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.45 }}>
        Paste rows from the client app (header + lines, tabs or commas). Billable minutes
        overwrite the stored day totals — scoreboard, progress bar, timeline + monthly follow.
      </p>
      <textarea
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        rows={5}
        placeholder={'Customer ID\tCall Date\tCall Start\tDuration (Minutes)\tBillable\tDropped\tPay\n1178\t09/08/2026\t09:35 AM\t10\tYes\tNo\t$0.00'}
        style={{
          display: 'block', width: '100%', padding: 8, background: '#0f172a',
          color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 6, fontSize: 10, fontFamily: 'monospace', resize: 'vertical',
        }}
      />
      {parsed && (
        <div style={{ fontSize: 11 }}>
          {parsed.days.length === 0 && <span style={{ color: '#f87171' }}>No valid rows{parsed.skipped ? ` · ${parsed.skipped} skipped` : ''}.</span>}
          {parsed.days.map((d) => (
            <div key={d.dateStr} style={{ color: '#e2e8f0', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <strong>{d.dateStr}</strong> · {d.billableCalls}/{d.calls} calls ·{' '}
              <span style={{ color: '#6ee7b7' }}>{d.billableMins}m on</span> · ~{d.offMinsEstimate}m off (9–18) · {d.firstStart}–{d.lastEnd}
            </div>
          ))}
          {parsed.skipped > 0 && <div style={{ color: '#fbbf24' }}>{parsed.skipped} row(s) skipped.</div>}
        </div>
      )}
      {status && <div style={{ fontSize: 11, color: '#6ee7b7' }} role="status">{status}</div>}
      <div>
        <button type="button" style={btnStyle} onClick={handleApply} disabled={!parsed || !parsed.days.length}>
          Apply to scoreboard
        </button>
      </div>
    </div>
  );
}

const btnStyle = {
  fontSize: 11, padding: '6px 10px', cursor: 'pointer',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, color: '#e2e8f0',
};
