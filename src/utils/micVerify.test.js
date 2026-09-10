// Tests for client-mic verify pure helpers (v4.97.0).

import {
  CLIENT_MIC_KEY,
  MIC_VERIFY_LAST_KEY,
  rmsOfFrame,
  stripDefaultPrefix,
  findEdgeDefaultInput,
  probeTargets,
  sameDeviceName,
  summarizeProbe,
  formatMicChip,
  readPinnedClientMicLabel,
  writePinnedClientMicLabel,
  readLastVerify,
  writeLastVerify,
} from './micVerify';

const fakeStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};

const DEV = (label, deviceId = label, kind = 'audioinput') => ({ label, deviceId, kind });

describe('device helpers', () => {
  test('stripDefaultPrefix removes Default-/Communications- prefixes', () => {
    expect(stripDefaultPrefix('Default - Microphone (Realtek)')).toBe('Microphone (Realtek)');
    expect(stripDefaultPrefix('Communications - Voicemeeter Out B1')).toBe('Voicemeeter Out B1');
    expect(stripDefaultPrefix('Microphone (Realtek)')).toBe('Microphone (Realtek)');
  });

  test('findEdgeDefaultInput resolves the default alias to its real label', () => {
    const devices = [
      DEV('Default - Microphone (Realtek)', 'default'),
      DEV('Microphone (Realtek)', 'abc'),
      DEV('Voicemeeter Out B1', 'b1'),
    ];
    expect(findEdgeDefaultInput(devices)).toEqual({ deviceId: 'default', label: 'Microphone (Realtek)' });
    expect(findEdgeDefaultInput([DEV('Mic', 'x', 'audiooutput')])).toBe(null);
  });

  test('probeTargets skips default/communications aliases and caps', () => {
    const devices = [
      DEV('Default - A', 'default'),
      DEV('Communications - A', 'communications'),
      DEV('A', 'a'),
      DEV('B', 'b'),
    ];
    expect(probeTargets(devices).map((d) => d.deviceId)).toEqual(['a', 'b']);
    expect(probeTargets(devices, 1)).toHaveLength(1);
  });

  test('sameDeviceName ignores case, punctuation and prefixes', () => {
    expect(sameDeviceName('Default - Voicemeeter Out B1', 'voicemeeter out b1')).toBe(true);
    expect(sameDeviceName('Voicemeeter Out B1 (VB-Audio)', 'Voicemeeter Out B1')).toBe(true);
    expect(sameDeviceName('Voicemeeter Out B1', 'Microphone (Realtek)')).toBe(false);
    expect(sameDeviceName('', '')).toBe(true);
  });
});

describe('rmsOfFrame', () => {
  test('silence (128 center) is zero', () => {
    expect(rmsOfFrame(new Array(512).fill(128))).toBe(0);
    expect(rmsOfFrame([])).toBe(0);
  });

  test('full-scale square wave is ~1', () => {
    const frame = new Array(256).fill(255).map((v, i) => (i % 2 ? 1 : 255));
    expect(rmsOfFrame(frame)).toBeGreaterThan(0.9);
  });
});

describe('summarizeProbe', () => {
  const devices = [DEV('Microphone (Realtek)', 'abc'), DEV('Voicemeeter Out B1 (VB-Audio)', 'b1')];
  const edgeDefault = { deviceId: 'default', label: 'Microphone (Realtek)' };
  const liveB1 = [{ label: 'Voicemeeter Out B1 (VB-Audio)', sampleRate: 48000, maxRms: 0.2 }];

  test('no pick yet → coach', () => {
    const v = summarizeProbe({ devices, edgeDefault, pinnedLabel: '', results: liveB1 });
    expect(v.tone).toBe('warn');
    expect(v.hints.join(' ')).toMatch(/client mic/i);
  });

  test('pinned mic vanished → warn + re-pick hint', () => {
    const v = summarizeProbe({ devices, edgeDefault, pinnedLabel: 'Old USB Mic', results: [] });
    expect(v.tone).toBe('warn');
    expect(v.headline).toMatch(/gone/i);
  });

  test('live voice on pinned mic, edge default differs → LIVE headline but warn tone', () => {
    const v = summarizeProbe({ devices, edgeDefault, pinnedLabel: 'Voicemeeter Out B1 (VB-Audio)', results: liveB1 });
    expect(v.tone).toBe('warn'); // mismatch escalates — the platform grabs Edge's default
    expect(v.headline).toMatch(/LIVE/);
    expect(v.edgeDefaultMismatch).toBe(true); // edge default is Realtek — flagged separately
  });

  test('mismatch escalates a pass to warn with a platform-tab hint', () => {
    const v = summarizeProbe({ devices, edgeDefault, pinnedLabel: 'Voicemeeter Out B1 (VB-Audio)', results: liveB1 });
    expect(v.tone).toBe('warn');
    expect(v.hints.join(' ')).toMatch(/Edge default mic/i);
  });

  test('matching edge default keeps pass clean', () => {
    const v = summarizeProbe({
      devices,
      edgeDefault: { deviceId: 'default', label: 'Voicemeeter Out B1 (VB-Audio)' },
      pinnedLabel: 'Voicemeeter Out B1',
      results: liveB1,
    });
    expect(v.tone).toBe('pass');
    expect(v.edgeDefaultMismatch).toBe(false);
  });

  test('silent pinned mic → fail with routing/mixer hints', () => {
    const v = summarizeProbe({
      devices,
      edgeDefault,
      pinnedLabel: 'Voicemeeter Out B1 (VB-Audio)',
      results: [{ label: 'Voicemeeter Out B1 (VB-Audio)', sampleRate: 48000, maxRms: 0.001 }],
    });
    expect(v.tone).toBe('fail');
    expect(v.hints.join(' ')).toMatch(/VoiceMeeter/);
    expect(v.hints.join(' ')).toMatch(/Windows/);
  });

  test('non-48k sample rate adds the mismatch hint', () => {
    const v = summarizeProbe({
      devices,
      edgeDefault: { deviceId: 'default', label: 'Voicemeeter Out B1 (VB-Audio)' },
      pinnedLabel: 'Voicemeeter Out B1',
      results: [{ label: 'Voicemeeter Out B1 (VB-Audio)', sampleRate: 44100, maxRms: 0.2 }],
    });
    expect(v.hzWarning).toBe(true);
    expect(v.hints.join(' ')).toMatch(/48k/);
  });

  test('pinned listed but stream failed to open → fail', () => {
    const v = summarizeProbe({ devices, edgeDefault, pinnedLabel: 'Microphone (Realtek)', results: [] });
    expect(v.tone).toBe('fail');
    expect(v.headline).toMatch(/Could not open/i);
  });
});

describe('storage + chip', () => {
  test('pinned label round-trips', () => {
    const s = fakeStorage();
    expect(readPinnedClientMicLabel(s)).toBe('');
    writePinnedClientMicLabel('Voicemeeter Out B1', s);
    expect(readPinnedClientMicLabel(s)).toBe('Voicemeeter Out B1');
    expect(s.getItem(CLIENT_MIC_KEY)).toBe('Voicemeeter Out B1');
  });

  test('last verdict round-trips and corrupt JSON is null', () => {
    const s = fakeStorage();
    writeLastVerify({ tone: 'pass', label: 'B1', at: 123 }, s);
    expect(readLastVerify(s)).toEqual({ tone: 'pass', label: 'B1', at: 123 });
    s.setItem(MIC_VERIFY_LAST_KEY, '{oops');
    expect(readLastVerify(s)).toBe(null);
  });

  test('formatMicChip: verdict shows glyph+time, untested shows label, none → null', () => {
    const chip = formatMicChip({ tone: 'pass', label: 'Voicemeeter Out B1', at: new Date('2026-09-10T09:42:00').getTime() });
    expect(chip.text).toMatch(/🎤 Voicemeeter Out B1 ✅ 09:42/);
    expect(chip.color).toBe('#34d399');

    const long = formatMicChip({ tone: 'pass', label: 'Voicemeeter Out B1 (VB-Audio)', at: Date.now() });
    expect(long.text).toMatch(/VB…/); // header chip truncates long names

    const untested = formatMicChip(null, { fallbackLabel: 'Microphone (Realtek)' });
    expect(untested.text).toMatch(/untested/);

    expect(formatMicChip(null, { fallbackLabel: '' })).toBe(null);
  });
});
