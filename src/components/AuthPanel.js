import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  loadSoundboardMetaLocal,
  saveSoundboardMetaLocal,
} from '../services/soundboardMetaService';

const btn = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 11,
};

const input = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.35)',
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: 11,
};

export function AuthPanel({ onCloudSaved }) {
  const {
    user,
    authConfigured,
    authError,
    syncState,
    importPrompt,
    signInWithGoogle,
    signOut,
    confirmImport,
    dismissImport,
    pushCloud,
  } = useAuth();
  const [busy, setBusy] = useState(false);
  const [soundItems, setSoundItems] = useState(loadSoundboardMetaLocal);
  const [savedMsg, setSavedMsg] = useState('');

  if (!authConfigured) {
    return (
      <div style={{ fontSize: 11, lineHeight: 1.5, opacity: 0.85 }}>
        Cloud sync needs Firebase env vars on Vercel:
        <code style={{ display: 'block', marginTop: 6 }}>REACT_APP_FIREBASE_*</code>
        App still works locally without them.
      </div>
    );
  }

  const run = async (fn) => {
    setBusy(true);
    setSavedMsg('');
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {importPrompt && (
        <div style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.08)' }}>
          <div style={{ fontSize: 11, marginBottom: 8 }}>
            Import this browser setup to your account? ({importPrompt.keyCount} prefs)
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" style={btn} disabled={busy} onClick={() => run(confirmImport)}>
              Import
            </button>
            <button type="button" style={btn} disabled={busy} onClick={dismissImport}>
              Skip
            </button>
          </div>
        </div>
      )}

      {user ? (
        <>
          <div style={{ fontSize: 11, lineHeight: 1.5 }}>
            Signed in as <strong>{user.displayName || user.email}</strong>
            <div style={{ opacity: 0.7 }}>uid: {user.uid}</div>
            <div style={{ opacity: 0.7 }}>sync: {syncState}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              style={btn}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await pushCloud();
                  setSavedMsg('Cloud saved.');
                  onCloudSaved?.();
                })
              }
            >
              Save now
            </button>
            <button type="button" style={btn} disabled={busy} onClick={() => run(signOut)}>
              Sign out
            </button>
          </div>
        </>
      ) : (
        <button type="button" style={{ ...btn, background: 'rgba(59,130,246,0.25)' }} disabled={busy} onClick={() => run(signInWithGoogle)}>
          Sign in with Google
        </button>
      )}

      {authError && <div style={{ color: '#f87171', fontSize: 11 }}>{authError}</div>}
      {savedMsg && <div style={{ color: '#34d399', fontSize: 11 }}>{savedMsg}</div>}

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>Soundboard text (metadata only)</div>
        <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
          {soundItems.map((item, idx) => (
            <div key={item.id} style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontSize: 10, opacity: 0.7 }}>{item.id}</div>
              <input
                style={input}
                value={item.label}
                onChange={(e) => {
                  const next = [...soundItems];
                  next[idx] = { ...item, label: e.target.value };
                  setSoundItems(next);
                }}
                placeholder="Label"
              />
              <textarea
                style={{ ...input, minHeight: 48, resize: 'vertical' }}
                value={item.text}
                onChange={(e) => {
                  const next = [...soundItems];
                  next[idx] = { ...item, text: e.target.value };
                  setSoundItems(next);
                }}
                placeholder="Spoken text prompt"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          style={{ ...btn, marginTop: 8 }}
          disabled={busy}
          onClick={() =>
            run(async () => {
              saveSoundboardMetaLocal(soundItems);
              if (user) await pushCloud();
              setSavedMsg('Soundboard text saved.');
            })
          }
        >
          Save soundboard text
        </button>
      </div>
    </div>
  );
}
