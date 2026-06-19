import React from 'react';
import { getTranslationEngineHealth } from '../utils/translationEngines';

const REASON_LABEL = {
  rate_limit: 'rate limited (429)',
  cors_or_network: 'blocked by browser / CORS',
  timeout: 'timed out',
  error: 'error',
  passthrough: 'same language echoed back',
};

const ENGINE_LABEL = {
  deepl: 'DeepL',
  openai: 'OpenAI',
  google_gtx: 'Google (free)',
  mymemory: 'MyMemory (free)',
};

/** Plain-language translation engine status for Settings and bubble hints. */
export const TranslationStatusBar = ({ meta = null, compact = false }) => {
  const health = getTranslationEngineHealth();
  const last = meta || health.lastAttempt;
  const { keys, chain, blocked } = health;

  const keyLine = [
    keys.deepl ? 'DeepL key saved' : 'no DeepL key',
    keys.openai ? 'OpenAI key saved' : 'no OpenAI key',
  ].join(' · ');

  const chainLine = chain.length
    ? chain.map((id) => ENGINE_LABEL[id] || id).join(' → ')
    : 'no engines available';

  return (
    <div
      style={{
        padding: compact ? '0.35rem 0.5rem' : '0.5rem 0.65rem',
        borderRadius: 6,
        background: 'rgba(59,130,246,0.06)',
        border: '1px solid rgba(59,130,246,0.2)',
        fontSize: compact ? '0.62rem' : '0.68rem',
        lineHeight: 1.4,
        color: 'rgba(255,255,255,0.85)',
      }}
    >
      <div style={{ fontWeight: 800, color: '#93c5fd', marginBottom: 4 }}>
        Translation engines [v4.54.0]
      </div>
      <div>{keyLine}</div>
      <div style={{ marginTop: 2 }}>Chain: {chainLine}</div>
      {blocked.length > 0 && (
        <div style={{ marginTop: 2, color: '#fbbf24' }}>
          Paused: {blocked.map((id) => ENGINE_LABEL[id] || id).join(', ')}
        </div>
      )}
      {!keys.deepl && !keys.openai && (
        <div style={{ marginTop: 4, color: '#fcd34d' }}>
          Tip: add a DeepL key below for reliable translations on production.
        </div>
      )}
      {last && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {last.engineId ? (
            <span style={{ color: last.quality === 'weak' ? '#fbbf24' : '#34d399' }}>
              Last: {ENGINE_LABEL[last.engineId] || last.engineId}
              {last.quality === 'weak' ? ' (weak — same word kept)' : ' ✓'}
            </span>
          ) : (
            <span style={{ color: '#fca5a5' }}>Last attempt: all engines failed</span>
          )}
          {last.failures?.length > 0 && (
            <div style={{ marginTop: 2, color: '#fca5a5' }}>
              {last.failures.slice(-3).map((f, i) => (
                <div key={i}>
                  {ENGINE_LABEL[f.id] || f.id}: {REASON_LABEL[f.reason] || f.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
