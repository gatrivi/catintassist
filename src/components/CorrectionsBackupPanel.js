import React, { useState } from 'react';
import {
  loadCorrections,
  exportCorrections,
  importCorrections,
  clearCorrections,
} from '../utils/transcriptCorrections';

/** Settings UI — export / import / clear taught STT + glossary corrections. */
export function CorrectionsBackupPanel() {
  const [status, setStatus] = useState('');
  const [importText, setImportText] = useState('');
  const count = loadCorrections().length;

  const flash = (msg, ms = 3000) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), ms);
  };

  const handleExport = async () => {
    const json = exportCorrections();
    try {
      await navigator.clipboard.writeText(json);
      flash(`Copied ${count} correction(s) to clipboard`);
    } catch {
      flash('Export ready — copy from box below');
      setImportText(json);
    }
  };

  const handleDownload = () => {
    const json = exportCorrections();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catint-corrections-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash(`Downloaded ${count} correction(s)`);
  };

  const handleImport = () => {
    const result = importCorrections(importText);
    if (result.imported === 0 && importText.trim()) {
      flash('Import failed — check JSON format');
      return;
    }
    setImportText('');
    flash(`Imported ${result.imported} · total ${result.total}`);
  };

  const handleClear = () => {
    if (!window.confirm(`Delete all ${count} taught correction(s)? Cannot undo.`)) return;
    clearCorrections();
    flash('All corrections cleared');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.45 }}>
        Bubble teach data (STT fixes + translation glossary). Stored locally in{' '}
        <code style={{ color: '#93c5fd' }}>catint_corrections_v1</code>.
      </p>
      <div style={{ fontSize: 11, color: '#6ee7b7' }}>{count} correction(s) saved</div>
      {status && (
        <div style={{ fontSize: 11, color: '#fbbf24' }} role="status">
          {status}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button type="button" style={btnStyle} onClick={handleExport} disabled={count === 0}>
          Copy JSON
        </button>
        <button type="button" style={btnStyle} onClick={handleDownload} disabled={count === 0}>
          Download .json
        </button>
        <button type="button" style={{ ...btnStyle, color: '#f87171' }} onClick={handleClear} disabled={count === 0}>
          Clear all
        </button>
      </div>
      <label style={{ fontSize: 11, color: '#93c5fd' }}>
        Paste JSON to merge import
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={5}
          placeholder='[{"sourceHeard":"mid vail","corrected":"Midvale","lang":"en",...}]'
          style={{
            display: 'block',
            width: '100%',
            marginTop: 4,
            padding: 8,
            background: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            fontSize: 10,
            fontFamily: 'monospace',
            resize: 'vertical',
          }}
        />
      </label>
      <button type="button" style={btnStyle} onClick={handleImport} disabled={!importText.trim()}>
        Merge import
      </button>
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
