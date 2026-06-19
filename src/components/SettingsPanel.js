import React, { useEffect, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import DeepgramKeyVault from './DeepgramKeyVault';
import { TranslationKeysForm } from './TranslationKeysForm';

const MOODS = ['auto', 'default', 'fast', 'chill'];
const MOOD_LABELS = { auto: 'Trans Auto', default: 'Default', fast: 'Fast', chill: 'Chill' };

export default function SettingsPanel({ open, onClose, initialSection = 'deepgram' }) {
  const {
    translationMood,
    setTranslationMood,
    speechAutoConnect,
    setSpeechAutoConnect,
    vaultStatus,
  } = useSession();
  const [section, setSection] = useState(initialSection);

  useEffect(() => {
    if (open) setSection(initialSection);
  }, [open, initialSection]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999998,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(380px, 96vw)',
          height: '100%',
          background: '#0b1220',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          padding: 14,
          overflowY: 'auto',
          color: '#fff',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Settings [v4.51.0]</h3>
          <button type="button" onClick={onClose} style={tabBtn}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
          {['deepgram', 'translation', 'behavior'].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              style={{ ...tabBtn, background: section === id ? 'rgba(59,130,246,0.25)' : tabBtn.background }}
            >
              {id === 'deepgram' ? 'Deepgram' : id === 'translation' ? 'Translation' : 'Behavior'}
            </button>
          ))}
        </div>

        {vaultStatus === 'unlocking' && (
          <p style={{ color: '#f59e0b', fontSize: 11, marginTop: 8 }}>⏳ Decrypting key…</p>
        )}

        {section === 'deepgram' && (
          <div style={{ marginTop: 12 }}>
            <DeepgramKeyVault embedded />
          </div>
        )}

        {section === 'translation' && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#93c5fd', marginBottom: 6 }}>Translation mode</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTranslationMood(m)}
                    style={{
                      ...tabBtn,
                      background: translationMood === m ? 'rgba(16,185,129,0.25)' : tabBtn.background,
                    }}
                  >
                    {MOOD_LABELS[m] || m}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: '6px 0 0' }}>
                Trans Auto = translate sealed sentences only (saves API quota).
              </p>
            </div>
            <TranslationKeysForm />
          </div>
        )}

        {section === 'behavior' && (
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={speechAutoConnect}
                onChange={(e) => setSpeechAutoConnect(e.target.checked)}
              />
              Speech Auto Connect — start call when speech detected
            </label>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
              Requires audio attached. Trailing silence deducted on STOP if you forgot the button.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const tabBtn = {
  padding: '4px 8px',
  fontSize: 10,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  color: '#fff',
  cursor: 'pointer',
};
