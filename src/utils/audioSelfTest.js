/** Offline audio self-test — local speakers and virtual sink route. */

export const TEST_TONE_MS = 900;
export const TEST_TONE_HZ = 440;

/** Build a short sine tone as WAV blob URL. */
export const createTestToneUrl = (durationMs = TEST_TONE_MS, frequencyHz = TEST_TONE_HZ) => {
  const sampleRate = 44100;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const fade = Math.min(1, i / 200, (numSamples - i) / 200);
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * 0.25 * fade;
    view.setInt16(44 + i * 2, sample * 0x7fff, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

export const playTestToneLocal = async (volume = 0.6) => {
  const url = createTestToneUrl();
  const audio = new Audio(url);
  audio.volume = volume;
  try {
    await audio.play();
    await new Promise((r) => setTimeout(r, TEST_TONE_MS + 80));
  } finally {
    audio.pause();
    URL.revokeObjectURL(url);
  }
};

export const playTestToneSink = async (sinkId, volume = 0.6) => {
  if (!sinkId) throw new Error('No virtual output selected');
  const url = createTestToneUrl();
  const audio = new Audio(url);
  audio.volume = volume;
  if (audio.setSinkId) {
    await audio.setSinkId(sinkId);
  }
  try {
    await audio.play();
    await new Promise((r) => setTimeout(r, TEST_TONE_MS + 80));
  } finally {
    audio.pause();
    URL.revokeObjectURL(url);
  }
};

/** Map Deepgram confidence to health label (matches GreetingsPanel). */
export const classifyHealthScore = (score) => {
  if (score === undefined || score === null) return { label: 'UNTESTED', color: '#94a3b8', width: '0%' };
  if (score >= 0.9) return { label: 'PEACHES', color: '#10b981', width: '100%' };
  if (score >= 0.75) return { label: 'GOOD', color: '#34d399', width: '75%' };
  if (score >= 0.5) return { label: 'PASSING', color: '#fbbf24', width: '50%' };
  return { label: 'UNACCEPTABLE', color: '#ef4444', width: '25%' };
};

const HEALTH_EMOJI = {
  PEACHES: ' 🍑',
  GOOD: ' ✅',
  PASSING: ' ⚠️',
  UNACCEPTABLE: ' ⛔',
};

/** UI label with emoji — single display source for GreetingsPanel. */
export const formatHealthDisplay = (score) => {
  if (score === undefined || score === null) return null;
  const base = classifyHealthScore(score);
  if (base.label === 'UNTESTED') return null;
  return {
    ...base,
    label: `${base.label}${HEALTH_EMOJI[base.label] || ''}`,
  };
};

export const analyzeBlobHealth = async (blob, apiKey) => {
  if (!blob || !apiKey) return null;
  const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': blob.type || 'audio/webm',
    },
    body: blob,
  });
  if (!res.ok) throw new Error('Deepgram health check failed');
  const data = await res.json();
  const conf = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  return transcript.length < 3 ? 0.1 : conf;
};

export const truncateDeviceLabel = (label, max = 14) => {
  const clean = (label || 'Default').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
};

/** Mic mode — local speakers/headphones only (no VB-Cable). */
export const isLocalOnlyPlayback = (micTestMode = false) => Boolean(micTestMode);

/** @deprecated use isLocalOnlyPlayback */
export const isLocalOnlySoundboardPlayback = isLocalOnlyPlayback;

export const CLIP_HEALTH_MIN = 0.5;

/** Deepgram health score passes caller-path gate. */
export const isClipHealthOk = (score) => score !== undefined && score !== null && score >= CLIP_HEALTH_MIN;

/**
 * 3-step off-call preflight: quality → you hear → caller path.
 * @returns {'missing'|'pending'|'ok'|'fail'|'confirm'}
 */
export const getPreflightSteps = ({
  hasClip,
  healthScore,
  callPathOk,
  awaitingConfirm,
}) => ({
  quality: !hasClip
    ? 'missing'
    : healthScore === undefined || healthScore === null
      ? 'pending'
      : isClipHealthOk(healthScore)
        ? 'ok'
        : 'fail',
  caller: !hasClip
    ? 'missing'
    : callPathOk
      ? 'ok'
      : awaitingConfirm
        ? 'confirm'
        : 'pending',
});

export const isPreflightReady = (steps) => steps.quality === 'ok' && steps.caller === 'ok';
