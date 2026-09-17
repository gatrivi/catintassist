import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DashboardHeader } from './DashboardHeader';

// v4.131.0 regression: the 💵⏱☕ targets chip (DailyTargetsChip, mounted through
// the local StickyTargetsChip) must stay reachable OFF-CALL in the scoreboard
// workspace — the default idle view. 3884ce5 moved the chip into the audio strip
// trailing slot but left the scoreboard branch of that ternary strip-only, so the
// chip silently vanished from the view where it matters most.
//
// These tests assert the REAL wiring: DashboardHeader is rendered in the off-call
// scoreboard state and the chip is looked up INSIDE `.audio-route-status-main`
// (the TAB/VB/mic audio chips row = the sticky row region), not just anywhere in
// the tree.

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

/** The audio chips row (TAB/VB + mic + Deepgram proof) — the sticky row region. */
const audioChipsRow = () => document.querySelector('.audio-route-status-main');

/** The targets chip, but ONLY when it sits inside the audio chips row. */
const chipInAudioChipsRow = () => audioChipsRow()?.querySelector('#daily-targets-chip') || null;

describe('DashboardHeader off-call targets chip (v4.131.0)', () => {
  test('scoreboard view, collapsed metrics: chip rides the audio chips row', () => {
    renderOffCall('scoreboard');

    const row = audioChipsRow();
    expect(row).not.toBeNull();
    expect(chipInAudioChipsRow()).not.toBeNull();
    // The audio strip itself must stay mounted (TAB/VB proof) — the fix must not
    // have replaced the strip with the chip.
    expect(row.querySelector('.audio-route-compact-proof')).not.toBeNull();
    // Exactly one chip: no duplicate mount from the old inline-row era.
    expect(document.querySelectorAll('#daily-targets-chip')).toHaveLength(1);
  });

  test('scoreboard view, expanded metrics: chip survives the expand toggle', () => {
    renderOffCall('scoreboard');

    // Collapsed → the inline strip carries the "Metrics" expand toggle.
    const expandBtn = document.getElementById('header-metrics-expand-btn');
    expect(expandBtn).not.toBeNull();
    fireEvent.click(expandBtn);

    // Expanded: the same single row still holds chip + metrics strip.
    expect(chipInAudioChipsRow()).not.toBeNull();
    expect(document.querySelectorAll('#daily-targets-chip')).toHaveLength(1);
    const row = audioChipsRow();
    expect(row).not.toBeNull();
    // One physical line — the chip and the strip are siblings of the same row,
    // and the row never wraps (layout invariant: audio strip is not pushed down).
    expect(row.querySelector('#daily-targets-chip')).not.toBeNull();
    expect(row.querySelector('.header-metrics-strip-row--inline')).not.toBeNull();
  });

  test('non-scoreboard off-call view (soundboard) keeps its chip', () => {
    renderOffCall('soundboard');
    expect(chipInAudioChipsRow()).not.toBeNull();
    expect(document.querySelectorAll('#daily-targets-chip')).toHaveLength(1);
  });
});
