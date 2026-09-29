/**
 * v4.131.0 on-call greetings pill — what fires, hear-it opt-in, stop now.
 * All media/payment-adjacent APIs are mocked (same pattern as GreetingsPanel.test.js).
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ACTIONS } from './GreetingsPanel';
import { ON_CALL_SLOTS, OnCallSoundboardStrip, galleryScanKeys, GALLERY_THUMB_KEYS } from './OnCallSoundboardStrip';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { loadFile } from '../utils/storage';
import { readCallerMonitor } from '../utils/callerMonitor';
import { getWorkSlot, writeSlotOverride, SLOT_OVERRIDE_KEY } from '../utils/workTime';
import { GALLERY_PICKS_KEY, MAX_GALLERY, writeGalleryPicks } from '../utils/oncallGallery';

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

/**
 * v4.171.0: the scan reads every greeting, not just the picked ones, so the
 * picker can mark recorded vs unrecorded before you add anything.
 */
const TOTAL_LOADS = galleryScanKeys().length + GALLERY_THUMB_KEYS().length;

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

/* v4.171.0 — the gallery is yours: pick what sits on the strip. */
describe('gallery picker (v4.171.0)', () => {
  /** The ⚙ tile only exists in the expanded row — expand only if needed. */
  const openGallery = () => {
    if (!screen.queryByRole('button', { name: '⚙' })) expand();
  };
  const openPicker = () => {
    openGallery();
    fireEvent.click(screen.getByRole('button', { name: '⚙' }));
  };
  const chip = (name) => screen.getByRole('button', { name: new RegExp(name) });
  const tileNamed = (name) => screen.getByText(name);

  test('a greeting the old hardcoded seven could never show can be added', async () => {
    // hold_policy exists in ACTIONS but was unreachable from the strip.
    expect(ON_CALL_SLOTS.some((s) => s.actionId === 'hold_policy')).toBe(false);
    loadFile.mockImplementation(async (key) => (key === 'hold_policy' ? clip() : null));

    const restore = withSlot('morning');
    try {
      await renderStrip();
      openGallery();
      expect(screen.queryByText('Hold Policy')).not.toBeInTheDocument();

      openPicker();
      // The picker is the whole point: more to choose from than the old seven.
      expect(ACTIONS.length).toBeGreaterThan(ON_CALL_SLOTS.length);
      fireEvent.click(chip('Hold Policy'));
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      expect(tileNamed('Hold Policy')).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  test('a recorded greeting is marked as such in the picker, an unrecorded one is not', async () => {
    loadFile.mockImplementation(async (key) => (key === 'voicemail' ? clip() : null));
    const restore = withSlot('morning');
    try {
      await renderStrip();
      openPicker();

      expect(chip('Voicemail')).not.toHaveClass('is-unrecorded');
      expect(chip('Operator')).toHaveClass('is-unrecorded');
    } finally {
      restore();
    }
  });

  test('the pick is persisted and comes back after a reload', async () => {
    loadFile.mockImplementation(async () => null);
    const restore = withSlot('morning');
    try {
      const first = await renderStrip();
      openPicker();
      fireEvent.click(chip('Voicemail'));
      expect(JSON.parse(localStorage.getItem(GALLERY_PICKS_KEY))).toContain('voicemail');

      first.unmount();
      loadFile.mockClear(); // the reload gets its own scan
      await renderStrip();
      openGallery();
      expect(tileNamed('Voicemail')).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  test('dropping a greeting takes its tile off the strip', async () => {
    loadFile.mockImplementation(async () => null);
    const restore = withSlot('morning');
    try {
      writeGalleryPicks(['greeting_en', 'voicemail']);
      await renderStrip();
      openGallery();
      expect(tileNamed('Voicemail')).toBeInTheDocument();

      openPicker();
      fireEvent.click(chip('Voicemail'));
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      expect(screen.queryByText('Voicemail')).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  test('the row is capped at 8 and the ninth tap explains itself', async () => {
    loadFile.mockImplementation(async () => null);
    const restore = withSlot('morning');
    try {
      writeGalleryPicks(ACTIONS.slice(0, MAX_GALLERY).map((a) => a.id));
      await renderStrip();
      openPicker();

      expect(screen.getByText(`${MAX_GALLERY}/${MAX_GALLERY} on the strip`)).toBeInTheDocument();
      fireEvent.click(chip('Operator'));

      expect(await screen.findByText(new RegExp(`Max ${MAX_GALLERY} greetings`))).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem(GALLERY_PICKS_KEY))).toHaveLength(MAX_GALLERY);
    } finally {
      restore();
    }
  });
});

describe('nothing on the strip is ever a dead button (v4.171.0)', () => {
  test('a tile with no recording says which slot is empty instead of doing nothing', async () => {
    loadFile.mockImplementation(async () => null);
    const restore = withSlot('afternoon');
    try {
      await renderStrip();
      expand();

      const tile = (await openers())[0];
      // aria-disabled, not disabled: the tap still reaches the explanation.
      expect(tile).toHaveAttribute('aria-disabled', 'true');
      expect(tile).not.toBeDisabled();

      fireEvent.click(tile);
      expect(await screen.findByText(/No Opener – Client recording for the Afternoon slot/)).toBeInTheDocument();
      expect(settings.playClipToSink).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  test('a gate refusal parks a chip that offers the off-call test', async () => {
    const blob = clip();
    loadFile.mockImplementation(async (key) => (key === 'greeting_en_morning' ? blob : null));
    // Health is fine, but there is no CALL OK for this route.
    localStorage.setItem('catint_audio_health', JSON.stringify({ greeting_en_morning: 0.9 }));
    const onOpenGreetingEditor = jest.fn();

    const restore = withSlot('morning');
    try {
      await renderStrip({ onOpenGreetingEditor });
      expand();
      fireEvent.click((await openers())[0]);

      const block = await screen.findByText(/is not verified for this route/);
      expect(block).toBeInTheDocument();
      expect(settings.playClipToSink).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Test it' }));
      expect(onOpenGreetingEditor).toHaveBeenCalledWith('greeting_en_morning');

      // And it can be waved away.
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByText(/is not verified for this route/)).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  test('mid-call the chip says "off-call only" rather than offering a dead button', async () => {
    const blob = clip();
    loadFile.mockImplementation(async (key) => (key === 'greeting_en_morning' ? blob : null));
    localStorage.setItem('catint_audio_health', JSON.stringify({ greeting_en_morning: 0.9 }));

    const restore = withSlot('morning');
    try {
      // App passes null on a live call: there is nowhere to go.
      await renderStrip({ onOpenGreetingEditor: null });
      expand();
      fireEvent.click((await openers())[0]);

      expect(await screen.findByText(/off-call only/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Test it' })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  test('no caller output named in the chip, never a silent no-op', async () => {
    const blob = clip();
    loadFile.mockImplementation(async (key) => (key === 'greeting_en_morning' ? blob : null));
    // CALL OK is fine for THIS route — the missing sink is the only problem, so
    // the proof has to be fingerprinted against the empty sink too.
    localStorage.setItem('catint_audio_health', JSON.stringify({ greeting_en_morning: 0.9 }));
    localStorage.setItem('catint_manual_call_ok_v1', JSON.stringify({
      'greeting_en||': { at: 1, clipKey: 'greeting_en_morning', sinkId: '', micId: '' },
    }));
    settings.selectedSinkId = '';

    const restore = withSlot('morning');
    try {
      await renderStrip();
      expand();
      fireEvent.click((await openers())[0]);

      expect(await screen.findByText(/no caller output picked/)).toBeInTheDocument();
      expect(settings.playClipToSink).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  test('a clip recorded anywhere re-scans the strip that fires it', async () => {
    const blob = clip();
    loadFile.mockImplementation(async () => null);
    const restore = withSlot('morning');
    try {
      await renderStrip();
      const before = loadFile.mock.calls.length;

      // Storage fires this on every save/delete; a fresh greeting must show up
      // without a reload, mid-call included.
      loadFile.mockImplementation(async (key) => (key === 'greeting_en_morning' ? blob : null));
      act(() => { window.dispatchEvent(new Event('catint_soundboard_changed')); });
      await waitFor(() => expect(loadFile.mock.calls.length).toBeGreaterThan(before));
      await act(async () => { await Promise.resolve(); });

      expand();
      expect((await openers())[0]).not.toHaveAttribute('aria-disabled', 'true');
    } finally {
      restore();
    }
  });
});
