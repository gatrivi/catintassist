import React, { useCallback, useEffect, useState } from 'react';
import {
  SCOPE_IDS,
  SCOPE_META,
  appBackupSummary,
  describeRestoreReport,
  downloadAppBackup,
  estimateScopeSizes,
  formatBytes as fmtBytes,
  restoreAppBackup,
  validateAppBackup,
} from '../utils/appBackup';
import { APP_VERSION_LABEL } from '../constants/version';

/**
 * Settings → Data: the whole-app backup in one file.
 *
 * Complements, never replaces, GreetingsPanel's clip downloads and
 * CorrectionsBackupPanel: this one carries the localStorage half (goals +
 * month progress + prefs) alongside the greeting audio, in one dated file.
 */
export function AppBackupPanel() {
  const [selected, setSelected] = useState(() => Object.fromEntries(SCOPE_IDS.map((id) => [id, true])));
  const [sizes, setSizes] = useState({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [importText, setImportText] = useState('');
  const [pending, setPending] = useState(null);
  const [reloadNeeded, setReloadNeeded] = useState(false);

  const chosen = SCOPE_IDS.filter((id) => selected[id]);
  const totalBytes = SCOPE_IDS.reduce((sum, id) => sum + (selected[id] ? (sizes[id]?.bytes || 0) : 0), 0);

  const refreshSizes = useCallback(async () => {
    try {
      setSizes(await estimateScopeSizes(SCOPE_IDS));
    } catch {
      setSizes({});
    }
  }, []);

  useEffect(() => { refreshSizes(); }, [refreshSizes]);

  const flash = (msg) => setStatus(msg);

  const runDownload = async (scopes) => {
    setError('');
    try {
      const { filename, bytes, warnings } = await downloadAppBackup({ scopes });
      flash(`Downloaded ${filename} · ${fmtBytes(bytes)}${warnings?.length ? ` · ${warnings.join('; ')}` : ''}`);
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    }
  };

  const handleDownload = () => {
    if (!chosen.length) { setError('Pick at least one scope to back up'); return; }
    runDownload(chosen);
  };

  /** Validate first — nothing is written until the user confirms. */
  const prepareRestore = async (text) => {
    setError('');
    setStatus('');
    const check = validateAppBackup(text);
    if (!check.ok) {
      setPending(null);
      setError(check.reason);
      return;
    }
    let backup;
    try {
      backup = JSON.parse(text);
    } catch {
      setPending(null);
      setError('Not valid JSON');
      return;
    }
    setPending({ backup, summary: appBackupSummary(backup), scopes: check.scopes });
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setImportText('');
      await prepareRestore(text);
      setStatus(`${file.name} (${fmtBytes(file.size)}) ready — confirm below`);
    } catch (err) {
      setError(`Could not read ${file.name}: ${err.message}`);
    } finally {
      event.target.value = '';
    }
  };

  const handleRestore = async () => {
    if (!pending) return;
    const report = await restoreAppBackup(pending.backup);
    if (!report.ok) {
      setError(report.error || 'Restore failed');
      return;
    }
    setPending(null);
    setImportText('');
    setReloadNeeded(true);
    flash(`${describeRestoreReport(report)} · reload the app to apply`);
    refreshSizes();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.45 }}>
        One file with the things a hot reload wipes: <b style={{ color: '#93c5fd' }}>goals</b>,{' '}
        <b style={{ color: '#93c5fd' }}>month progress</b>, greeting audio, settings and taught corrections.
        No transcripts, no notes, and <b style={{ color: '#f87171' }}>never API keys</b> [{APP_VERSION_LABEL}]
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {SCOPE_IDS.map((id) => (
          <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#e2e8f0' }}>
            <input
              id={`app-backup-scope-${id}`}
              type="checkbox"
              checked={!!selected[id]}
              onChange={(e) => setSelected((prev) => ({ ...prev, [id]: e.target.checked }))}
            />
            <span style={{ minWidth: 96 }}>{SCOPE_META[id].label}</span>
            <span id={`app-backup-size-${id}`} style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
              {sizes[id]?.detail || SCOPE_META[id].hint}
            </span>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <button type="button" id="app-backup-download" style={btnStyle} onClick={handleDownload}>
          Download backup (.json)
        </button>
        <span id="app-backup-size-total" style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
          {sizes && Object.keys(sizes).length ? `currently ~${fmtBytes(totalBytes)} on this machine` : ''}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Just one scope:</span>
        {SCOPE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            id={`app-backup-download-${id}`}
            style={{ ...btnStyle, padding: '4px 8px', fontSize: 10 }}
            onClick={() => runDownload([id])}
            title={`Download only ${SCOPE_META[id].label.toLowerCase()}`}
          >
            {SCOPE_META[id].label}
          </button>
        ))}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 11, color: '#93c5fd' }} htmlFor="app-backup-file">
          Restore from file
        </label>
        <input
          id="app-backup-file"
          type="file"
          accept=".json,application/json"
          onChange={handleFile}
          style={{ ...inputStyle, padding: 6 }}
        />
        <textarea
          id="app-backup-paste"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={3}
          placeholder="…or paste the backup JSON here"
          aria-label="Paste backup JSON"
          style={inputStyle}
        />
        <button
          type="button"
          id="app-backup-restore-prepare"
          style={{ ...btnStyle, alignSelf: 'flex-start' }}
          onClick={() => prepareRestore(importText)}
          disabled={!importText.trim()}
        >
          Check pasted backup
        </button>
      </div>

      {pending && (
        <div id="app-backup-confirm" style={confirmStyle}>
          <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700 }}>
            Overwrite existing data? ({pending.scopes.join(', ')})
          </div>
          <ul style={{ margin: '4px 0 6px 16px', padding: 0, fontSize: 10, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>
            {pending.summary.entries.map((entry) => (
              <li key={entry.id}>
                <b>{SCOPE_META[entry.id].label}</b>: file carries {entry.detail} (~
                {fmtBytes(entry.bytes)}) → this app has {sizes[entry.id]?.detail || 'nothing'}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: '0 0 8px' }}>
            Today&apos;s date/month bookkeeping is never restored, and fields the file does not carry stay as they are.
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" id="app-backup-restore-confirm" style={btnStyle} onClick={handleRestore}>
              Overwrite &amp; restore
            </button>
            <button type="button" id="app-backup-restore-cancel" style={btnStyle} onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {status && (
        <div id="app-backup-status" role="status" style={{ fontSize: 11, color: '#fbbf24' }}>
          {status}
        </div>
      )}
      {error && (
        <div id="app-backup-error" role="alert" style={{ fontSize: 11, color: '#f87171' }}>
          {error}
        </div>
      )}
      {reloadNeeded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" id="app-backup-reload" style={btnStyle} onClick={() => window.location.reload()}>
            Reload app to apply
          </button>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            the running session keeps its own copy of these numbers until reload
          </span>
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  fontSize: 11,
  padding: '6px 10px',
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  color: '#e2e8f0',
};

const inputStyle = {
  display: 'block',
  width: '100%',
  padding: 8,
  background: '#0f172a',
  color: '#e2e8f0',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 6,
  fontSize: 10,
  fontFamily: 'monospace',
  resize: 'vertical',
};

const confirmStyle = {
  border: '1px solid rgba(251,191,36,0.4)',
  background: 'rgba(251,191,36,0.06)',
  borderRadius: 6,
  padding: 10,
};
