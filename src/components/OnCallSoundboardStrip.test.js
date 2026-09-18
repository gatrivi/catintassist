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
import { getWorkSlot, writeSlotOverride, SLOT_OVERRIDE_KEY } from '../utils/workTime';

jest.mock('../contexts/AudioSettingsContext', () => ({ useAudioSettings: jest.fn() }));
jest.mock('../utils/storage');
jest.mock('../utils/audioRoute', () => ({
  bindAudioToSink: jest.fn().mockResolvedValue(true),
  primePlaybackElements: jest.fn(),
  rampVolume: jest.fn(),
}));
// v4.131.1: the slot is now computed in US Central by the shared helper, so
// tests pin the helper's answer instead of standing in for the machine clock.
jest.mock('../utils/workTime', () => {
  const actual = jest.requireActual('../utils/workTime');
  return { ...actual, getWorkSlot: jest.fn(actual.getWorkSlot) };
});

const realGetWorkSlot = jest.requireActual('../utils/workTime').getWorkSlot;
/** Pin the Central slot; restores the real clock rule afterwards. */
const withSlot = (slot) => {
  getWorkSlot.mockReturnValue(slot);
  return () => getWorkSlot.mockImplementation(realGetWorkSlot);
};

// CRA's jest config resets mocks before every test, which also drops the
// factory's default implementation — re-arm the real Central rule each time.
beforeEach(() => getWorkSlot.mockImplementation(realGetWorkSlot));

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
  test.each([['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']])(
    'in the %s slot the pill reads Greetings · %s',
    async (slot, label) => {
      const restore = withSlot(slot);
      try {
        await renderStrip();
        expect(screen.getByRole('button', { name: new RegExp(`Greetings · ${label}`) })).toBeInTheDocument();
      } finally {
        restore();
      }
    }
  );

  test('a greeting with no recording at all is called out while collapsed', async () => {
    loadFile.mockImplementation(async () => null);
    const restore = withSlot('morning');
    try {
      await renderStrip();
      expect(await screen.findByText('· EN missing')).toBeInTheDocument();
      expect(screen.getByText('· ES missing')).toBeInTheDocument();
    } finally {
      restore();
    }
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

describe('manual slot picker (v4.131.1 — the pick beats the clock)', () => {
  const pick = (short) => screen.getByRole('button', { name: short });
  const pill = (label) => screen.getByRole('button', { name: new RegExp(`Greetings · ${label}`) });
  const auto = () => screen.getByRole('button', { name: 'A' });

  test('a saved pick survives a reload (slot state seeds from getWorkSlot)', async () => {
    // No slot mock here: getWorkSlot reads the real override, which is the
    // point — the stored pick must beat whatever today's clock says.
    writeSlotOverride('evening');
    await renderStrip();
    expect(pill('Evening')).toBeInTheDocument();
    expect(pick('Eve')).toHaveAttribute('aria-pressed', 'true');
    expect(auto()).toHaveAttribute('aria-pressed', 'false');
  });

  test('the A button carries the old clock readout and the buttons share one group', async () => {
    const restore = withSlot('morning');
    try {
      await renderStrip();
      expect(auto().getAttribute('title')).toMatch(
        /Automatic - follows the work clock \(\w+ now, .+ America\/Chicago\)/
      );
      // The standalone `.on-call-sb-clock` span is gone — its info lives in A.
      expect(document.querySelector('.on-call-sb-clock')).toBeNull();
      const group = document.querySelector('[data-guide="on-call-slot-pick"]');
      expect(group).not.toBeNull();
      ['AM', 'PM', 'Eve', 'A'].forEach((short) => {
        expect(pick(short)).toHaveClass('on-call-sb-pick');
      });
      expect(pick('AM').getAttribute('title')).toBe('Play the Morning recording');
      expect(pick('PM').getAttribute('title')).toBe('Play the Afternoon recording');
      expect(pick('Eve').getAttribute('title')).toBe('Play the Evening recording');
    } finally {
      restore();
    }
  });

  test('clicking PM switches the pill and the EN tile to the afternoon clip', async () => {
    const blob = clip();
    loadFile.mockImplementation(async (key) => (key === 'greeting_en_afternoon' ? blob : null));
    allowCallerFire('greeting_en_afternoon');

    const restore = withSlot('morning');
    try {
      await renderStrip();
      expect(pill('Morning')).toBeInTheDocument();

      fireEvent.click(pick('PM'));

      // Same click: pill label, button state and the persisted pick all move.
      expect(pill('Afternoon')).toBeInTheDocument();
      expect(pick('PM')).toHaveAttribute('aria-pressed', 'true');
      expect(pick('AM')).toHaveAttribute('aria-pressed', 'false');
      expect(localStorage.getItem(SLOT_OVERRIDE_KEY)).toBe('afternoon');

      // The slot change re-scans the clips — settle that inside act() first.
      await waitFor(() => expect(loadFile).toHaveBeenCalledTimes(TOTAL_LOADS * 2));
      await act(async () => { await Promise.resolve(); });

      expand();
      fireEvent.click((await openers())[0]);

      await waitFor(() => expect(settings.playClipToSink).toHaveBeenCalledWith(
        blob,
        settings.sinkVolume,
        expect.objectContaining({ clipKey: 'greeting_en_afternoon' }),
      ));
    } finally {
      restore();
    }
  });

  test('clicking A clears the pick and returns to the clock slot', async () => {
    writeSlotOverride('evening');
    const restore = withSlot('morning');
    try {
      await renderStrip();
      expect(pill('Morning')).toBeInTheDocument(); // mocked clock wins on mount

      fireEvent.click(pick('Eve'));
      expect(pill('Evening')).toBeInTheDocument();
      expect(localStorage.getItem(SLOT_OVERRIDE_KEY)).toBe('evening');

      fireEvent.click(auto());

      expect(localStorage.getItem(SLOT_OVERRIDE_KEY)).toBeNull();
      expect(pill('Morning')).toBeInTheDocument(); // back on the mocked auto slot
      expect(auto()).toHaveAttribute('aria-pressed', 'true');
      expect(pick('Eve')).toHaveAttribute('aria-pressed', 'false');

      // both picks re-scanned the clips — drain those state updates
      await waitFor(() => expect(loadFile).toHaveBeenCalledTimes(TOTAL_LOADS * 3));
      await act(async () => { await Promise.resolve(); });
    } finally {
      restore();
    }
  });
});

describe('fallback recording', () => {
  test('evening with only a Morning clip cues the fallback and fires the morning key', async () => {
    const blob = clip();
    loadFile.mockImplementation(async (key) => (key === 'greeting_en_morning' ? blob : null));
    allowCallerFire('greeting_en_morning');

    const restore = withSlot('evening');
    try {
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
    } finally {
      restore();
    }
  });
});

describe('Stop while collapsed', () => {
  test('a playing clip exposes Stop in the pill and clicking it kills playback', async () => {
    const blob = clip();
    loadFile.mockImplementation(async (key) => (key === 'greeting_en_morning' ? blob : null));

    const restore = withSlot('morning');
    try {
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
    } finally {
      restore();
    }
  });
});
