import { useEffect, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import {
  loadAutopilotPhrases,
  saveAutopilotPhrases,
  phrasesToText,
  textToPhrases,
} from '../utils/callAutopilot';

/**
 * Settings → Behavior section for Call Autopilot (v4.98.0): the on/off
 * toggle, the editable start/end phrase lists, and the LOG-ONLY tone-listener
 * diagnostics (what the experimental ring/bell watcher is hearing).
 */
export const AutopilotSettings = () => {
  const { callAutopilot, setCallAutopilot } = useSession();
  const [text, setText] = useState(() => phrasesToText(loadAutopilotPhrases()));
  const [savedAt, setSavedAt] = useState(0);
  const [tone, setTone] = useState(null);

  // Poll the log-only tone watcher while this panel is open.
  useEffect(() => {
    if (!callAutopilot) return undefined;
    const iv = setInterval(() => {
      setTone(window.__catintTone ? window.__catintTone.summary() : null);
    }, 1000);
    return () => clearInterval(iv);
  }, [callAutopilot]);

  return (
    <div style={{ marginTop: 14 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={callAutopilot}
          onChange={(e) => setCallAutopilot(e.target.checked)}
        />
        🤖 Call Autopilot — auto start/end from platform phrases (v4.98.0)
      </label>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: '6px 0 0' }}>
        The platform's own announcements run the session: a bridge phrase ("call is being bridged") STARTS
        the call, a disconnect phrase ("the caller has disconnected") opens a 10s banner you can cancel.
        Speech alone no longer starts calls. Still needs one CONNECT press per browser session so the ear
        is open. Queue announcements ("please continue to hold…") never start a call.
      </p>

      <details style={{ marginTop: 8 }}>
        <summary style={{ fontSize: 11, cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
          Phrase lists ({loadAutopilotPhrases().start.length} start / {loadAutopilotPhrases().end.length} end)
        </summary>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={10}
          style={{
            width: '100%',
            marginTop: 6,
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            fontSize: 11,
            padding: 6,
            fontFamily: 'monospace',
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <button
            type="button"
            onClick={() => {
              saveAutopilotPhrases(textToPhrases(text, loadAutopilotPhrases()));
              setText(phrasesToText(loadAutopilotPhrases()));
              setSavedAt(Date.now());
            }}
            style={{
              background: 'rgba(16,185,129,0.25)',
              border: '1px solid rgba(16,185,129,0.45)',
              color: '#6ee7b7',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Save phrases
          </button>
          {savedAt > 0 && (
            <span style={{ fontSize: 10, color: 'rgba(16,185,129,0.8)' }}>saved ✓</span>
          )}
        </div>
      </details>

      <details style={{ marginTop: 8 }}>
        <summary style={{ fontSize: 11, cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
          🔔 Ring/bell listener (experimental — log only)
        </summary>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: '6px 0 0' }}>
          Watches the platform tab's audio for narrow-band tones (your ring / end bell). It does not act
          yet — this list tells us what your platform actually sounds like so the detector can be tuned.
          Play a ring while armed and watch this.
        </p>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 4, fontFamily: 'monospace' }}>
          {tone
            ? `tone frames (60s): ${tone.toneFrames} · dominant ~${tone.dominantHz}Hz` +
              (tone.log.length ? `\n${tone.log.slice(0, 3).join('\n')}` : '')
            : 'listening… (no tone data yet)'}
        </div>
      </details>
    </div>
  );
};
