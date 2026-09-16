import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GreetingEditorView, buildClipIndex, familyCompletion } from './GreetingEditorView';
import { ACTIONS } from './GreetingsPanel';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { loadFile, listStorageKeys } from '../utils/storage';
import { APP_VERSION_LABEL } from '../constants/version';

jest.mock('../contexts/AudioSettingsContext', () => ({
  useAudioSettings: jest.fn(),
}));
jest.mock('../utils/storage', () => ({
  saveFile: jest.fn(),
  loadFile: jest.fn(),
  deleteFile: jest.fn(),
  listStorageKeys: jest.fn(),
  generateObjectUrl: jest.fn(() => 'blob:mock'),
}));
jest.mock('../utils/audioSelfTest', () => ({
  analyzeClipLegibility: jest.fn(),
  formatHealthDisplay: jest.fn((score) =>
    score == null ? null : { label: 'GOOD ✅', color: '#34d399', width: '75%' }),
  explainHealth: jest.fn(() => ({ why: 'w', fix: 'f' })),
  playTestToneSink: jest.fn(() => Promise.resolve()),
  capSinkTestVolume: jest.fn((v) => v * 0.5),
  SINK_TEST_TONE_VOL: 0.3,
}));
jest.mock('./AudioEditorPanel', () => () => <div data-testid="audio-editor" />);

const SETTINGS = {
  selectedSinkId: 'sink-1',
  selectedMicId: 'mic-1',
  selectedRecMicId: '',
  outputDevices: [{ deviceId: 'sink-1', label: 'CABLE Input' }],
  inputDevices: [],
  localVolume: 1,
  sinkVolume: 1,
  playClipToSink: jest.fn(() => Promise.resolve({ ok: true })),
  stopClipToSink: jest.fn(),
  monitorMic: false,
  setMonitorMic: jest.fn(),
  monitorVolume: 0.5,
  setMonitorVolume: jest.fn(),
};

const oneBlob = () => new Blob(['x'], { type: 'audio/webm' });

beforeEach(() => {
  jest.clearAllMocks();
  useAudioSettings.mockReturnValue({ ...SETTINGS });
  listStorageKeys.mockResolvedValue(['greeting_en_morning']);
  loadFile.mockImplementation(async (key) => (key === 'greeting_en_morning' ? oneBlob() : null));
});

const renderView = (props = {}) => render(
  <GreetingEditorView onExit={jest.fn()} onOpenStudio={jest.fn()} {...props} />,
);

describe('buildClipIndex / familyCompletion (v4.118.0)', () => {
  test('expands dynamic actions into three time slots', () => {
    const idx = buildClipIndex();
    const opener = idx.filter((c) => c.familyId === 'greeting_en');
    expect(opener.map((c) => c.slot)).toEqual(['morning', 'afternoon', 'evening']);
  });

  test('counts saved vs total per family', () => {
    const clips = buildClipIndex({ greeting_en_morning: true });
    const comp = familyCompletion(ACTIONS[0], clips, { greeting_en_morning: true });
    expect(comp).toEqual({ saved: 1, total: 3 });
  });
});

describe('GreetingEditorView', () => {
  test('renders the micro-header with version label', async () => {
    renderView();
    expect(screen.getByText('✎ Greeting Editor')).toBeInTheDocument();
    await screen.findByText(APP_VERSION_LABEL);
  });

  test('shows every action family in the rail', async () => {
    renderView();
    await waitFor(() => expect(screen.getAllByText('Opener – Client').length).toBeGreaterThan(0));
    ACTIONS.forEach((a) => {
      expect(screen.getAllByText(a.label).length).toBeGreaterThan(0);
    });
  });

  test('record and navigation controls exist; local-only badge shows before CALL OK', async () => {
    renderView();
    await screen.findByText('LOCAL ONLY');
    expect(screen.getByRole('button', { name: /re-?record/i })).toBeInTheDocument();
    expect(screen.getByTitle('Previous greeting (←)')).toBeInTheDocument();
    expect(screen.getByTitle('Next greeting (→)')).toBeInTheDocument();
  });

  test('◀ navigates to the previous clip', async () => {
    renderView();
    await screen.findByText('LOCAL ONLY');
    fireEvent.click(screen.getByTitle('Previous greeting (←)'));
    // Last clip in the index is voicemail (wraps from index 0 → end).
    expect(screen.getAllByText(/Voicemail/).length).toBeGreaterThan(0);
  });

  test('inline waveform editor mounts for a saved clip', async () => {
    renderView({ initialClipKey: 'greeting_en_morning' });
    await screen.findByTestId('audio-editor');
  });

  test('Escape calls onExit', async () => {
    const onExit = jest.fn();
    renderView({ onExit });
    await screen.findByText('LOCAL ONLY');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalled();
  });

  test('deep-links into an EMPTY slot too (no recording needed)', async () => {
    renderView({ initialClipKey: 'voicemail' });
    await screen.findByRole('heading', { name: /Voicemail/ });
    expect(screen.getByText(/Empty slot/)).toBeInTheDocument();
  });

  test('an unreadable stored clip surfaces as readable text (not console-only)', async () => {
    loadFile.mockResolvedValue(null); // key exists in DB but the blob is gone
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent(/missing or unreadable/i);
  });

  test('delete asks inside the view (no window.confirm)', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm');
    renderView({ initialClipKey: 'greeting_en_morning' });
    await screen.findByTestId('audio-editor');
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Delete recording' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog', { name: 'Delete recording' })).toBeNull();
    confirmSpy.mockRestore();
  });

  test('a caller test that fails never offers CALL OK', async () => {
    SETTINGS.playClipToSink.mockResolvedValueOnce({ ok: false, reason: 'sink_bind_failed' });
    useAudioSettings.mockReturnValue({ ...SETTINGS });
    renderView({ initialClipKey: 'greeting_en_morning' });
    await screen.findByTestId('audio-editor');
    fireEvent.click(screen.getByRole('button', { name: /Caller/ }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /mark CALL OK/i })).toBeNull();
  });
});
