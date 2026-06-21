import React, { useEffect, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import DeepgramKeyVault from './DeepgramKeyVault';
import { TranslationKeysForm } from './TranslationKeysForm';
import { TranslationStatusBar } from './TranslationStatusBar';
import { APP_VERSION_LABEL } from '../constants/version';
import { isWellbeingDockEnabled, setWellbeingDockEnabled } from '../utils/wellbeingDock';
import { useTTS } from '../hooks/useTTS';
import {
  COMPONENT_LABELS,
  DEFAULT_COMPONENT_VISIBILITY,
  VISIBILITY_MODES,
  loadComponentVisibility,
  saveComponentVisibility,
} from '../utils/componentVisibility';
import {
  loadLanguagePair,
  saveLanguagePair,
  isEnEsProtectionMode,
  groupedLanguageOptions,
  getLangLabel,
} from '../utils/languageConfig';
import { DevSimulatePanel } from './DevSimulatePanel';
import { isDevSimEnabled } from '../utils/devSimulateCaptions';

const MOODS = ['auto', 'default', 'fast', 'chill'];
const MOOD_LABELS = { auto: 'Trans Auto', default: 'Default', fast: 'Fast', chill: 'Chill' };

export default function SettingsPanel({ open, onClose, initialSection = 'deepgram' }) {
  const {
    translationMood,
    setTranslationMood,
    speechAutoConnect,
    setSpeechAutoConnect,
    vaultStatus,
    autoAttachEnabled,
    setAutoAttachEnabled,
  } = useSession();
  const [section, setSection] = useState(initialSection);
  const [personalDock, setPersonalDock] = useState(isWellbeingDockEnabled);
  const [componentVisibility, setComponentVisibility] = useState(loadComponentVisibility);
  const [languagePair, setLanguagePair] = useState(loadLanguagePair);

  const [disableOnboardingAnimations, setDisableOnboardingAnimations] = useState(() => {
    try {
      return localStorage.getItem('catint_onboarding_anim_disabled_v1') === '1';
    } catch {
      return false;
    }
  });
  const { playTTS } = useTTS();

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
          <h3 style={{ margin: 0, fontSize: 14 }}>Settings [{APP_VERSION_LABEL}]</h3>
          <button type="button" onClick={onClose} style={tabBtn}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
          {['deepgram', 'language', 'translation', 'behavior', 'layout', 'display'].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              style={{ ...tabBtn, background: section === id ? 'rgba(239,68,68,0.25)' : tabBtn.background }}
            >
              {id === 'deepgram' ? 'Deepgram' : id === 'language' ? 'Language' : id === 'translation' ? 'Translation' : id === 'behavior' ? 'Behavior' : id === 'layout' ? 'Layout' : 'Display'}
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

        {section === 'language' && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.45 }}>
              Left column = patient / column 1. Right column = interpreter / column 2. Default EN↔ES.
            </p>
            <label style={{ fontSize: 11, color: '#93c5fd' }}>
              Left column (patient)
              <select
                value={languagePair.left}
                onChange={(e) => {
                  const next = saveLanguagePair({ ...languagePair, left: e.target.value });
                  setLanguagePair(next);
                }}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, background: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6 }}
              >
                {Object.entries(groupedLanguageOptions()).map(([group, items]) => (
                  <optgroup key={group} label={group}>
                    {items.map((item) => (
                      <option key={item.code} value={item.code}>{item.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 11, color: '#6ee7b7' }}>
              Right column (interpreter)
              <select
                value={languagePair.right}
                onChange={(e) => {
                  const next = saveLanguagePair({ ...languagePair, right: e.target.value });
                  setLanguagePair(next);
                }}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, background: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6 }}
              >
                {Object.entries(groupedLanguageOptions()).map(([group, items]) => (
                  <optgroup key={group} label={group}>
                    {items.map((item) => (
                      <option key={item.code} value={item.code}>{item.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <p style={{ fontSize: 10, color: isEnEsProtectionMode(languagePair) ? 'rgba(16,185,129,0.85)' : '#fbbf24', margin: 0 }}>
              {isEnEsProtectionMode(languagePair)
                ? `Active pair: ${getLangLabel(languagePair.left)} ↔ ${getLangLabel(languagePair.right)} — US number/phone protections ON.`
                : `Active pair: ${getLangLabel(languagePair.left)} ↔ ${getLangLabel(languagePair.right)} — US number/phone protections paused (EN↔ES only).`}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
              Space / Alt+Space force left/right STT lane for 30s. Changes reconnect live audio if attached.
            </p>
          </div>
        )}

        {section === 'translation' && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <TranslationStatusBar />
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', marginTop: 14 }}>
              <input
                type="checkbox"
                checked={personalDock}
                onChange={(e) => {
                  setWellbeingDockEnabled(e.target.checked);
                  setPersonalDock(e.target.checked);
                }}
              />
              Show interpreter wellbeing tools (desk breaks, hydration, pauses)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', marginTop: 14 }}>
              <input
                type="checkbox"
                checked={disableOnboardingAnimations}
                onChange={(e) => {
                  const next = e.target.checked;
                  setDisableOnboardingAnimations(next);
                  try {
                    localStorage.setItem('catint_onboarding_anim_disabled_v1', next ? '1' : '0');
                  } catch {}
                }}
              />
              Disable onboarding animations (guide spotlight only)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', marginTop: 14 }}>
              <input
                type="checkbox"
                checked={autoAttachEnabled}
                onChange={(e) => setAutoAttachEnabled(e.target.checked)}
              />
              Auto-attach interpreting tab at/after 09:00 (Chrome)
            </label>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: '6px 0 0' }}>
              OFF by default to avoid blocking browser permission dialogs on first use.
            </p>

            {process.env.NODE_ENV !== 'production' && (
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 11, color: '#93c5fd', marginBottom: 6 }}>Dev UI</div>
                <button
                  type="button"
                  style={{ ...tabBtn, fontSize: 11, marginRight: 8 }}
                  onClick={() => {
                    try {
                      window.dispatchEvent(
                        new CustomEvent('cat_demo_scenario', { detail: 'ui_call' })
                      );
                    } catch (_) {}
                  }}
                  title="Start the call UI (no real audio capture). Dev only."
                >
                  UI In Call Mode (no audio)
                </button>
                <button
                  type="button"
                  style={{ ...tabBtn, fontSize: 11 }}
                  onClick={() => {
                    try {
                      window.dispatchEvent(
                        new CustomEvent('cat_demo_scenario', { detail: 'reset' })
                      );
                    } catch (_) {}
                  }}
                  title="Reset the demo call UI."
                >
                  Reset
                </button>
              </div>
            )}
            {isDevSimEnabled() && <DevSimulatePanel />}
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 11, color: '#93c5fd', marginBottom: 6 }}>TTS route test</div>
              <button
                type="button"
                style={{ ...tabBtn, fontSize: 11 }}
                onClick={() => playTTS('Prueba de audio para la llamada.', 'es')}
              >
                Test TTS route (ES sample)
              </button>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                Plays through local speakers + virtual output (same path as bubble play). Inworld prefetch hooks here later.
              </p>
            </div>
          </div>
        )}

        {section === 'layout' && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 }}>
            Off-call layout: <strong style={{ color: '#93c5fd' }}>dashboard-header</strong> (scoreboard + progress) on top,
            {' '}<strong style={{ color: '#93c5fd' }}>interpret pane</strong> below (~80% viewport).
          </div>
        )}

        {section === 'display' && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: '#93c5fd', marginBottom: 4 }}>
              Component visibility [{APP_VERSION_LABEL}]
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: '0 0 10px' }}>
              Progress bars = monthly + daily timelines. Changes save instantly.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.keys(DEFAULT_COMPONENT_VISIBILITY).map((id) => (
                <div key={id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    {COMPONENT_LABELS[id] || id}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {VISIBILITY_MODES.map((mode) => (
                      <label
                        key={mode}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          cursor: 'pointer',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: componentVisibility[id] === mode ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                          border: componentVisibility[id] === mode ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <input
                          type="radio"
                          name={`vis-${id}`}
                          checked={componentVisibility[id] === mode}
                          onChange={() => {
                            const next = saveComponentVisibility({ ...componentVisibility, [id]: mode });
                            setComponentVisibility(next);
                          }}
                          style={{ margin: 0 }}
                        />
                        {mode === 'always' ? 'Always' : mode === 'on_call' ? 'On call' : mode === 'off_call' ? 'Off call' : 'Hidden'}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
