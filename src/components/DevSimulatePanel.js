import React, { useState } from 'react';
import { DEV_SIM_PRESETS } from '../utils/devSimulateCaptions';

const tabBtn = {
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)',
  color: '#e2e8f0',
  cursor: 'pointer',
};

const fire = (detail) => {
  try {
    window.dispatchEvent(new CustomEvent('cat_dev_simulate', { detail }));
  } catch (_) {}
};

/** Dev-only: inject fake transcription / translation for debugging. */
export function DevSimulatePanel() {
  const [text, setText] = useState('');
  const [lang, setLang] = useState('en');
  const [mockTranslation, setMockTranslation] = useState('');
  const [ensureCall, setEnsureCall] = useState(true);

  const inject = () => {
    if (!text.trim()) return;
    fire({
      action: 'inject',
      text: text.trim(),
      lang,
      ensureCall,
      mockTranslation: mockTranslation.trim() || undefined,
    });
  };

  return (
    <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 11, color: '#93c5fd', marginBottom: 6 }}>Simulate transcription / translation</div>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: '0 0 8px', lineHeight: 1.4 }}>
        Injects caption bubbles without Deepgram. Use presets for splits, phones, bad translations.
        Console: <code style={{ color: '#fcd34d' }}>__catDevSim.preset(&apos;phone_digits&apos;)</code>
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Custom transcript to inject…"
        rows={3}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontSize: 11,
          padding: 6,
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(0,0,0,0.35)',
          color: '#fff',
          resize: 'vertical',
          marginBottom: 6,
        }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          Lang
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            style={{ fontSize: 10, padding: '2px 4px' }}
          >
            <option value="en">EN</option>
            <option value="es">ES</option>
          </select>
        </label>
        <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={ensureCall} onChange={(e) => setEnsureCall(e.target.checked)} />
          UI call mode first
        </label>
      </div>

      <input
        type="text"
        value={mockTranslation}
        onChange={(e) => setMockTranslation(e.target.value)}
        placeholder="Optional mock translation (skips API)"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontSize: 10,
          padding: '4px 6px',
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(0,0,0,0.25)',
          color: '#a1a1aa',
          marginBottom: 8,
        }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <button type="button" style={{ ...tabBtn, fontSize: 11 }} onClick={inject}>
          Inject bubble
        </button>
        <button
          type="button"
          style={{ ...tabBtn, fontSize: 11 }}
          onClick={() => fire({ action: 'clear' })}
        >
          Clear captions
        </button>
      </div>

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>Presets</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {Object.entries(DEV_SIM_PRESETS).map(([id, preset]) => (
          <button
            key={id}
            type="button"
            style={{ ...tabBtn, fontSize: 10, padding: '3px 6px' }}
            title={id}
            onClick={() => fire({ action: 'preset', name: id })}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
