import React from 'react';
import { getTranslationEngineHealth } from '../utils/translationEngines';
import { APP_VERSION } from '../constants/version';

const REASON_LABEL = {
  rate_limit: 'rate limited (429)',
  unauthorized: 'unauthorized / key-region mismatch',
  cors_or_network: 'blocked by browser / CORS',
  timeout: 'timed out',
  error: 'error',
  passthrough: 'same language echoed back',
};

const ENGINE_LABEL = {
  deepl: 'DeepL',
  azure: 'Azure',
  openai: 'OpenAI',
  google_gtx: 'Google (free)',
  mymemory: 'MyMemory (free)',
};

/** Plain-language translation engine status for Settings and bubble hints. */
export const TranslationStatusBar = ({ meta = null, compact = false }) => {
  const health = getTranslationEngineHealth();
  const last = meta || health.lastAttempt;
  const { keys, chain, blocked, azureStatus, azureFallbackOnly, azureRegion } = health;

  const keyLabel = (name, has, source) => {
    if (!has) return `no ${name} key`;
    return source === 'env' ? `${name} key (env)` : `${name} key saved`;
  };

  const keyLine = [
    keyLabel('DeepL', keys.deepl, keys.sources?.deepl),
    keyLabel('Azure', keys.azure, keys.sources?.azure),
    keyLabel('OpenAI', keys.openai, keys.sources?.openai),
  ].join(' · ');

  const chainLine = chain.length
    ? chain.map((id) => ENGINE_LABEL[id] || id).join(' → ')
    : 'no engines available';

  const azureLineColor =
    azureStatus?.includes('ok') && !azureStatus?.includes('unverified')
      ? '#34d399'
      : azureStatus?.includes('missing')
        ? '#fcd34d'
        : azureStatus?.includes('unauthorized') || azureStatus?.includes('error')
          ? '#fca5a5'
          : '#fbbf24';

  return (
    <div
      style={{
        padding: compact ? '0.35rem 0.5rem' : '0.5rem 0.65rem',
        borderRadius: 6,
        background: 'rgba(239,68,68,0.06)',
        border: '1px solid rgba(239,68,68,0.2)',
        fontSize: compact ? '0.62rem' : '0.68rem',
        lineHeight: 1.4,
        color: 'rgba(255,255,255,0.85)',
      }}
    >
      <div style={{ fontWeight: 800, color: '#93c5fd', marginBottom: 4 }}>
        Translation engines [v{APP_VERSION}]
      </div>
      <div>{keyLine}</div>
      <div style={{ marginTop: 2, color: azureLineColor, fontWeight: 700 }}>
        {azureStatus}
        {keys.azure && azureRegion ? (
          <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>
            {' '}
            · region {azureRegion}
          </span>
        ) : null}
      </div>
      {azureFallbackOnly && (
        <div style={{ marginTop: 4, color: '#fcd34d', fontWeight: 700 }}>
          Translation smoke: fallback-chain only, Azure unavailable
        </div>
      )}
      <div style={{ marginTop: 2 }}>Chain: {chainLine}</div>
      {blocked.length > 0 && (
        <div style={{ marginTop: 2, color: '#fbbf24' }}>
          Paused: {blocked.map((id) => ENGINE_LABEL[id] || id).join(', ')}
        </div>
      )}
      {!keys.deepl && !keys.azure && !keys.openai && (
        <div style={{ marginTop: 4, color: '#fcd34d' }}>
          Tip: add Azure or DeepL key below for reliable translations on production.
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
