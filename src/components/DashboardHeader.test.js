import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DashboardHeader } from './DashboardHeader';

// v4.131.0 regression / v4.133.0 contract: the 💵⏱☕ targets chip (DailyTargetsChip,
// mounted through the local StickyTargetsChip) must stay reachable OFF-CALL in
// every off-call view — the scoreboard workspace (default idle view) plus the
// non-scoreboard views (soundboard / goals / greeting-editor).
//
// 3884ce5 pushed the chip into the audio chips row trailing slot; DailyTargetsChip
// sizes itself against `chip.closest('.session-controls-center')` (DailyTargetsChip.js:119),
// an ancestor that does NOT exist inside `.audio-route-status-main`. The chip then
// measured the whole audio line, kept all three pairs and painted over the TAB/VB
// proof spans. v4.133.0 puts it back in its own `.off-call-targets-row` INSIDE
// `.session-controls-center`, so the measurement box is the center column again.
//
// These tests assert the REAL wiring: DashboardHeader is rendered off-call and the
// chip is looked up INSIDE `.off-call-targets-row` — and explicitly NOT inside
// `.audio-route-status-main` (the TAB/VB/mic audio chips row).

/** Mutable session so each test can flip the state it cares about. */
const mockSession = {
  isActive: false,
  sessionSeconds: 0,
  sessionEarnings: 0,
  stats: {
    goalMinutes: 5500,
    monthlyMinutes: 1000,
    dailyMinutes: 50,
    dailyBreakMinutes: 10,
    dailyAvailMinutes: 0,
    dayStartTime: null,
    callsToday: 0,
    streak: 0,
  },
  updateStat: jest.fn(),
  stopSession: jest.fn(),
  endDay: jest.fn(),
  RATE_PER_MINUTE: 0.13,
  arsRate: 1000,
  setArsRate: jest.fn(),
  isBreakActive: false,
  breakSeconds: 0,
  startBreak: jest.fn(),
  stopBreak: jest.fn(),
  availSeconds: 0,
  isEditingScoreboard: false,
  setIsEditingScoreboard: jest.fn(),
  visibleCards: [],
  toggleCard: jest.fn(),
  visibleMetrics: [],
  toggleMetric: jest.fn(),
  scoreboardPreset: 'std',
  applyScoreboardPreset: jest.fn(),
  isNotesOpen: false,
  setIsNotesOpen: jest.fn(),
  isToolbarVisible: false,
  setIsToolbarVisible: jest.fn(),
  goalWorkDays: 28,
  isZombieCall: false,
  isScoreboardHelpVisible: false,
  setIsScoreboardHelpVisible: jest.fn(),
  isHold: false,
  setIsHold: jest.fn(),
  holdSeconds: 0,
  dailyTimeline: [],
  historyTimeline: {},
  dailyLog: {},
  lastActivityTime: 0,
  lastEnglishActivityTime: 0,
  isCallDetectionEnabled: false,
  setIsCallDetectionEnabled: jest.fn(),
  callFocusMode: false,
  setCallFocusMode: jest.fn(),
  minutesSinceLastBreak: 0,
  vaultStatus: null,
  getMonthResyncPreview: () => ({ sum: 1000, pastSum: 950, today: 50 }),
  reconcileMonthTotal: jest.fn(),
  lastCallSeconds: 0,
  lastCallEndedAt: 0,
};

jest.mock('../contexts/SessionContext', () => ({
  useSession: () => mockSession,
}));

jest.mock('../contexts/AudioSettingsContext', () => ({
  useAudioSettings: () => ({
    inputDevices: [], outputDevices: [], selectedMicId: '', selectedSinkId: '',
    changeMicId: jest.fn(), changeSinkId: jest.fn(), fetchDevices: jest.fn(),
    micLevel: 0, micStatus: 'idle',
  }),
}));

jest.mock('../hooks/useProgressiveAudio', () => ({
  useProgressiveAudio: () => ({ playTick: jest.fn(), playCarriageVault: jest.fn() }),
}));

// slot-text ships an ESM-only "exports" map — jest 27 cannot resolve it.
// The ticking counter is irrelevant here, so stub the leaf.
jest.mock('./SlotMicroValue', () => ({
  SlotMicroValue: ({ text }) => <span>{text}</span>,
}));

// The chip measures its own width to pick a fit level (jsdom has no ResizeObserver).
beforeAll(() => {
  if (typeof window !== 'undefined' && !window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const renderOffCall = (offCallWorkspace) =>
  render(<DashboardHeader offCallWorkspace={offCallWorkspace} connectionState="idle" />);

/** The audio chips row (TAB/VB + mic + Deepgram proof) — NOT a chip mount any more. */
const audioChipsRow = () => document.querySelector('.audio-route-status-main');

/** The chip's own off-call line, inside `.session-controls-center`. */
const targetsRow = () => document.querySelector('.off-call-targets-row');

/** The targets chip, but ONLY when it sits inside its dedicated off-call row. */
const chipInTargetsRow = () => targetsRow()?.querySelector('#daily-targets-chip') || null;

describe('DashboardHeader off-call targets chip (v4.133.0)', () => {
  beforeEach(() => {
    mockSession.isActive = false;
  });

  test('scoreboard view, collapsed metrics: chip rides its own off-call row', () => {
    renderOffCall('scoreboard');

    const row = targetsRow();
    expect(row).not.toBeNull();
    expect(chipInTargetsRow()).not.toBeNull();
    // The chip's line lives inside the measurement box it was designed for
    // (DailyTargetsChip measures closest('.session-controls-center')).
    expect(row.closest('.session-controls-center')).not.toBeNull();
    // And it is GONE from the audio chips row — that mount measured the wrong box
    // and painted over the TAB/VB proof spans.
    expect(audioChipsRow().querySelector('#daily-targets-chip')).toBeNull();
    // The audio strip itself must stay mounted (TAB/VB proof) — the fix must not
    // have replaced the strip with the chip.
    expect(audioChipsRow().querySelector('.audio-route-compact-proof')).not.toBeNull();
    // Exactly one chip: no duplicate mount from the audio-trailing-slot era.
    expect(document.querySelectorAll('#daily-targets-chip')).toHaveLength(1);
  });

  test('scoreboard view, expanded metrics: chip survives the expand toggle', () => {
    renderOffCall('scoreboard');

    // Collapsed → the inline strip carries the "Metrics" expand toggle.
    const expandBtn = document.getElementById('header-metrics-expand-btn');
    expect(expandBtn).not.toBeNull();
    fireEvent.click(expandBtn);

    // Expanded: still exactly one chip, still in its own row off the audio strip.
    expect(chipInTargetsRow()).not.toBeNull();
    expect(document.querySelectorAll('#daily-targets-chip')).toHaveLength(1);
    expect(audioChipsRow().querySelector('#daily-targets-chip')).toBeNull();
    // The inline metrics strip is the only thing left in the audio row's trailing
    // slot (v4.99.2) — chip and strip no longer share that line.
    expect(audioChipsRow().querySelector('.header-metrics-strip-row--inline')).not.toBeNull();
  });

  // Requirement: EVERY off-call view keeps the chip, and none of them may fall
  // back to the audio trailing slot (one bad path = the overlap bug returns).
  test.each(['soundboard', 'goals', 'greeting-editor'])(
    'non-scoreboard off-call view (%s) keeps its chip in the dedicated row',
    (workspace) => {
      renderOffCall(workspace);
      expect(targetsRow()).not.toBeNull();
      expect(chipInTargetsRow()).not.toBeNull();
      expect(audioChipsRow().querySelector('#daily-targets-chip')).toBeNull();
      expect(document.querySelectorAll('#daily-targets-chip')).toHaveLength(1);
    },
  );
});

// v4.132.0: the OFF-call MIC VERIFY chip moved OUT of #off-call-inline-row into
// Settings → Audio → Devices (SettingsPanel tests cover the new mount). The
// ON-call chip in the call micro bar was NOT part of the move — it must stay.
// A stored verdict is seeded so the chip would actually render if still mounted
// (the chip no-ops on empty storage, so an unseeded test would pass vacuously).
const seedMicVerdict = () => {
  localStorage.setItem(
    'CATINTASSIST_MIC_VERIFY_LAST',
    JSON.stringify({ tone: 'pass', label: 'CABLE Output (VB-Audio)', at: Date.UTC(2026, 8, 17, 12, 0, 0) }),
  );
};

describe('MIC VERIFY chip placement (v4.132.0)', () => {
  afterEach(() => {
    localStorage.clear();
    mockSession.isActive = false;
  });

  test('off-call: no chip in the header, the inline row keeps its gap counters', () => {
    seedMicVerdict();
    renderOffCall('scoreboard');

    const row = document.getElementById('off-call-inline-row');
    expect(row).not.toBeNull();
    expect(row.querySelector('.mic-verify-chip')).toBeNull();
    // Gone from the whole header off-call (no sneaky re-mount elsewhere).
    expect(document.querySelectorAll('.mic-verify-chip')).toHaveLength(0);
    // Row invariant kept: the gap/LAST counters still ride the same single row.
    expect(row.querySelector('#off-call-gap-row')).not.toBeNull();
  });

  test('on-call: chip still rides the call micro bar (untouched by the move)', () => {
    seedMicVerdict();
    mockSession.isActive = true;
    render(<DashboardHeader connectionState="idle" />);

    // In-call the header starts compact; the reserved chip slot lives in the
    // expanded call bar, so expand first (the exported component owns that state).
    fireEvent.click(document.getElementById('header-expand-btn'));

    const bar = document.querySelector('.call-micro-bar-row');
    expect(bar).not.toBeNull();
    expect(bar.querySelector('.mic-verify-chip')).not.toBeNull();
  });
});

// v4.164.0 — the header eval (docs/dashboard-header-eval.md). These are the
// fixes from that pass: each one is a real defect, and each gets a test so it
// cannot come back.
describe('header eval fixes (v4.164.0)', () => {
  let writeText;

  beforeEach(() => {
    localStorage.clear();
    mockSession.isActive = false;
    mockSession.stats.callsToday = 0;
    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
  });
  afterEach(() => {
    localStorage.clear();
    mockSession.isActive = false;
  });

  // The Greeting Editor had no scoreboard of its own, so the headerMinimal guard
  // let the full scoreboard + progress stack render above it — and at <=900px
  // that is 88px of clipped, unreachable content. Every workspace view hides it.
  test.each(['soundboard', 'goals', 'greeting-editor'])(
    'workspace view (%s) hides the scoreboard body instead of clipping it',
    (workspace) => {
      const { container } = renderOffCall(workspace);
      const header = container.querySelector('.dashboard-header');
      expect(header.className).toContain('dashboard-header--minimal');
      // No scoreboard body at all, so nothing can be clipped away.
      expect(container.querySelector('.condensed-header-card')).toBeNull();
      expect(container.querySelector('.header-progress-stack')).toBeNull();
      // The sticky row is what should remain.
      expect(container.querySelector('.session-controls-sticky-row')).not.toBeNull();
    },
  );

  // In meter-only mode the center column is display:none and the meter row
  // renders its own chip. Mounting both put #daily-targets-chip in the DOM twice.
  test('meter-only mode mounts the targets chip exactly once', () => {
    localStorage.setItem('catint_hud_meter_only_v1', '1');
    mockSession.isActive = true;
    const { container } = render(<DashboardHeader connectionState="idle" />);

    expect(document.querySelectorAll('#daily-targets-chip')).toHaveLength(1);
    // ...and it is the meter row's copy, not the hidden center-column one.
    const meter = container.querySelector('#compact-call-goal-meter');
    expect(meter).not.toBeNull();
    expect(meter.querySelector('#daily-targets-chip')).not.toBeNull();
  });

  test('normal in-call mode still has exactly one chip (in the center column)', () => {
    mockSession.isActive = true;
    const { container } = render(<DashboardHeader connectionState="idle" />);

    expect(document.querySelectorAll('#daily-targets-chip')).toHaveLength(1);
    expect(container.querySelector('.session-controls-center #daily-targets-chip')).not.toBeNull();
  });

  // .metric-pill has carried cursor:copy for a long time with nothing listening.
  // NOTE where these live: the condensed toolbar is skipped when
  // offCallScoreboardView (DashboardHeader.js:~2428) and the whole body is
  // hidden on the minimal views — so the pills are currently reachable only in
  // the in-call expanded header. That is the eval's "off-call toolbar has no
  // entry point" finding, and it is deliberately still open.
  test('the shift and log-off pills really copy their number now', async () => {
    mockSession.isActive = true;
    render(<DashboardHeader connectionState="idle" />);
    fireEvent.click(document.getElementById('header-expand-btn'));

    const shift = document.getElementById('pill-shift');
    const logoff = document.getElementById('pill-logoff');
    expect(shift).not.toBeNull();
    expect(logoff).not.toBeNull();
    // Keyboard reachable, not mouse-only.
    expect(shift.getAttribute('role')).toBe('button');
    expect(shift.getAttribute('tabindex')).toBe('0');
    expect(shift.getAttribute('title')).toMatch(/click to copy/i);

    fireEvent.click(shift);
    expect(writeText).toHaveBeenCalledTimes(1);
    const [copiedShift] = writeText.mock.calls[0];
    expect(String(copiedShift).trim().length).toBeGreaterThan(0);

    fireEvent.keyDown(logoff, { key: 'Enter' });
    expect(writeText).toHaveBeenCalledTimes(2);
    const [copiedLogoff] = writeText.mock.calls[1];
    expect(String(copiedLogoff).trim().length).toBeGreaterThan(0);
    // Log-off is the "what time should I stay" number — it must be copyable.
    expect(String(copiedLogoff)).toMatch(/\d/);
  });

  test('a pill with no number is not advertised as copyable', () => {
    mockSession.isActive = true;
    mockSession.stats.callsToday = 0;
    render(<DashboardHeader connectionState="idle" />);
    fireEvent.click(document.getElementById('header-expand-btn'));

    // The empty placeholder must not promise a copy it cannot do.
    const empty = document.getElementById('pill-no-calls');
    expect(empty).not.toBeNull();
    expect(empty.getAttribute('role')).toBeNull();
    expect(empty.style.cursor).toBe('default');
  });

  // The grab bar used to write maxHeight inline from localStorage, silently
  // beating every CSS cap. It is a custom property now, so the budget is
  // inspectable in the stylesheet.
  test('the grab-bar height is a CSS custom property, not an inline maxHeight', () => {
    localStorage.setItem('catint_scoreboard_max_vh', '55');
    const { container } = renderOffCall('scoreboard');
    const header = container.querySelector('.dashboard-header');

    expect(header.style.getPropertyValue('--scoreboard-max-vh')).toBe('55');
    expect(header.style.maxHeight).toBe('');
  });
});
