import {
  buildOffCallIdleDetail,
  buildOffCallStatusLabel,
  checklistForMode,
  pickRotatingAdvice,
  resolveIdleAudioMode,
  tipsForMode,
} from './offCallIdleMessages';

describe('resolveIdleAudioMode', () => {
  test('mic wins over VB and tab', () => {
    expect(resolveIdleAudioMode({ micTestMode: true, audioSourceMode: 'virtualCable' })).toBe('mic');
    expect(resolveIdleAudioMode({ micTestMode: true, audioSourceMode: 'tab' })).toBe('mic');
  });
  test('VB when not mic', () => {
    expect(resolveIdleAudioMode({ micTestMode: false, audioSourceMode: 'virtualCable' })).toBe(
      'virtualCable'
    );
  });
  test('tab default', () => {
    expect(resolveIdleAudioMode({})).toBe('tab');
  });
});

describe('mode-aware tips', () => {
  test('VB tips do not instruct tab share / Tab mode', () => {
    const tips = tipsForMode('virtualCable').join(' ');
    expect(tips).toMatch(/VB-Cable/);
    expect(tips).not.toMatch(/Tab mode/);
    expect(tips).not.toMatch(/share tab audio/i);
    expect(tips).not.toMatch(/re-open the browser tab picker/i);
  });
  test('mic tips do not instruct tab share', () => {
    const tips = tipsForMode('mic').join(' ');
    expect(tips).toMatch(/Mic mode/);
    expect(tips).not.toMatch(/share tab audio/i);
    expect(tips).not.toMatch(/re-open the browser tab picker/i);
  });
  test('checklist matches mode', () => {
    expect(checklistForMode('virtualCable')[0]).toMatch(/VB-Cable/);
    expect(checklistForMode('mic')[0]).toMatch(/mic/i);
    expect(checklistForMode('tab')[0]).toMatch(/tab/i);
  });
  test('pickRotatingAdvice uses mode list', () => {
    const tip = pickRotatingAdvice(0, 'virtualCable');
    expect(tip).toMatch(/VB-Cable/);
    expect(tip).not.toMatch(/Tab mode/);
  });
});

describe('buildOffCallIdleDetail', () => {
  test('VB mode ready copy — no Tab mode', () => {
    const { lines, mode } = buildOffCallIdleDetail({
      audioSourceMode: 'virtualCable',
      micTestMode: false,
      audioAttached: false,
      apiKeyMissing: false,
    });
    expect(mode).toBe('virtualCable');
    expect(lines.join(' ')).toMatch(/VB-Cable mode/);
    expect(lines.join(' ').toLowerCase()).not.toMatch(/tab mode/);
  });
  test('mic mode ready copy', () => {
    const { lines } = buildOffCallIdleDetail({
      micTestMode: true,
      audioAttached: false,
      apiKeyMissing: false,
    });
    expect(lines.join(' ')).toMatch(/Mic mode/);
  });
});

describe('buildOffCallStatusLabel', () => {
  test('VB connected', () => {
    expect(
      buildOffCallStatusLabel({
        audioAttached: true,
        audioSourceMode: 'virtualCable',
        apiKeyMissing: false,
      })
    ).toBe('VB connected');
  });
  test('mic connected', () => {
    expect(
      buildOffCallStatusLabel({
        audioAttached: true,
        micTestMode: true,
        apiKeyMissing: false,
      })
    ).toBe('Mic connected');
  });
  test('error shows real connectionMessage not generic Deepgram error', () => {
    expect(
      buildOffCallStatusLabel({
        connectionState: 'error',
        connectionMessage: 'Microphone access was denied. Please allow microphone permissions and press Connect again.',
        apiKeyMissing: false,
      })
    ).toMatch(/Microphone access was denied/);
  });
});
