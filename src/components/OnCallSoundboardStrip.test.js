/**
 * v4.131.0 on-call greetings pill — what fires, hear-it opt-in, stop now.
 * All media/payment-adjacent APIs are mocked (same pattern as GreetingsPanel.test.js).
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ON_CALL_SLOTS, OnCallSoundboardStrip } from './OnCallSoundboardStrip';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { loadFile } from '../utils/storage';
import { readCallerMonitor } from '../utils/callerMonitor';

jest.mock('../contexts/AudioSettingsContext', () => ({ useAudioSettings: jest.fn() }));
jest.mock('../utils/storage');
jest.mock('../utils/audioRoute', () => ({
  bindAudioToSink: jest.fn().mockResolvedValue(true),
  primePlaybackElements: jest.fn(),
  rampVolume: jest.fn(),
}));

const CALL_OK_SINK = 'voicemeeter-in-1';
const clip = () => new Blob(['greeting'], { type: 'audio/webm' });

let settings;
let mediaPlay;
let mediaPause;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  // jsdom has no object-URL support and no real media pipeline.
  URL.createObjectURL = jest.fn(() => 'blob:oncall-clip');
  URL.revokeObjectURL = jest.fn();
  mediaPlay = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  mediaPause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  settings = {
    selectedSinkId: CALL_OK_SINK,
    selectedMicId: '',
    localVolume: 0.7,
    sinkVolume: 0.9,
    playClipToSink: jest.fn().mockResolvedValue({ ok: true }),
    stopClipToSink: jest.fn(),
  };
  useAudioSettings.mockReturnValue(settings);
});

afterEach(() => {
  jest.restoreAllMocks();
  delete window.__CAT_AUDIO_VOL;
});

/** Proves the caller route: health score + CALL OK for the slot family. */
const allowCallerFire = (clipKey) => {
  localStorage.setItem('catint_audio_health', JSON.stringify({ [clipKey]: 0.9 }));
  localStorage.setItem('catint_manual_call_ok_v1', JSON.stringify({
    [`greeting_en|${CALL_OK_SINK}|`]: { at: 1, clipKey, sinkId: CALL_OK_SINK, micId: '' },
  }));
};

const withHour = async (hour, body) => {
  const spy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(hour);
  try {
    await body();
  } finally {
    spy.mockRestore();
  }
};

const openers = () => screen.findAllByRole('button', { name: /Opener/ });
const expand = () => fireEvent.click(screen.getByRole('button', { name: /Greetings/ }));

/** Clip keys + thumbs the mount effect scans (dynamic greetings load 3 slots). */
const TOTAL_LOADS = ON_CALL_SLOTS.reduce((n, s) => n + (s.dynamic ? 3 : 1), 0) + ON_CALL_SLOTS.length;

/** Render and let the async clip scan settle inside act — otherwise its state
    updates land after the test and React logs act() noise. */
const renderStrip = async (props = {}) => {
  const view = render(<OnCallSoundboardStrip {...props} />);
  await waitFor(() => expect(loadFile).toHaveBeenCalledTimes(TOTAL_LOADS));
  await act(async () => { await Promise.resolve(); });
  return view;
};

describe('collapsed pill names the live time-of-day slot', () => {
  test.each([[9, 'Morning'], [14, 'Afternoon'], [19, 'Evening']])(
    'at %i:00 the pill reads Greetings · %s',
    async (hour, label) => {
      await withHour(hour, async () => {
        await renderStrip();
        expect(screen.getByRole('button', { name: new RegExp(`Greetings · ${label}`) })).toBeInTheDocument();
      });
    }
  );

  test('a greeting with no recording at all is called out while collapsed', async () => {
    loadFile.mockImplementation(async () => null);
    await withHour(9, async () => {
      await renderStrip();
      expect(await screen.findByText('· EN missing')).toBeInTheDocument();
      expect(screen.getByText('· ES missing')).toBeInTheDocument();
    });
  });
});

describe('Hear control is reachable while collapsed and stays opt-in', () => {
  test('off by default, toggling writes the caller-monitor pref and syncs the checkbox', async () => {
    await renderStrip();
    const hear = screen.getByRole('button', { name: /Hear/ });

    expect(hear).toHaveAttribute('aria-pressed', 'false');
    expect(readCallerMonitor()).toBe(false);
    expect(localStorage.getItem('CATINT_CALLER_MONITOR')).not.toBe('1');

    fireEvent.click(hear);
    expect(hear).toHaveAttribute('aria-pressed', 'true');
    expect(readCallerMonitor()).toBe(true);
    expect(localStorage.getItem('CATINT_CALLER_MONITOR')).toBe('1');

    // same preference either way: the expanded checkbox mirrors it, and flipping
    // the checkbox is reflected back in the pill control.
    expand();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(readCallerMonitor()).toBe(false);
    expect(screen.getByRole('button', { name: /Hear/ })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('fallback recording', () => {
  test('evening with only a Morning clip cues the fallback and fires the morning key', async () => {
    const blob = clip();
    loadFile.mockImplementation(async (key) => (key === 'greeting_en_morning' ? blob : null));
    allowCallerFire('greeting_en_morning');

    await withHour(19, async () => {
      await renderStrip();

      const cue = await screen.findByText(/using Morning/);
      expect(cue).toHaveAttribute('title', expect.stringContaining('No Evening recording'));

      expand();
      fireEvent.click((await openers())[0]);

      await waitFor(() => expect(settings.playClipToSink).toHaveBeenCalledWith(
        blob,
        settings.sinkVolume,
        expect.objectContaining({ clipKey: 'greeting_en_morning' }),
      ));
    });
  });
});

describe('Stop while collapsed', () => {
  test('a playing clip exposes Stop in the pill and clicking it kills playback', async () => {
    const blob = clip();
    loadFile.mockImplementation(async (key) => (key === 'greeting_en_morning' ? blob : null));

    await withHour(9, async () => {
      await renderStrip({ micTestMode: true });

      expand();
      fireEvent.click((await openers())[0]);
      await waitFor(() => expect(mediaPlay).toHaveBeenCalled());
      // LIVE status lives in the toggle button, so it is on screen either state.
      expect(screen.getByRole('status')).toBeInTheDocument();

      // back to the pill: Stop must still be there
      expand();
      const stop = screen.getByRole('button', { name: /Stop/ });
      settings.stopClipToSink.mockClear();
      mediaPause.mockClear();

      fireEvent.click(stop);

      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
      expect(settings.stopClipToSink).toHaveBeenCalled();
      expect(mediaPause).toHaveBeenCalled();
    });
  });
});
