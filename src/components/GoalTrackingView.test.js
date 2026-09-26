import { render, screen, fireEvent } from '@testing-library/react';
import { GoalTrackingView } from './GoalTrackingView';
import { computeCatchUp, fmtHm, monthBasis } from '../utils/catchUpPlan';
import { APP_VERSION_LABEL } from '../constants/version';

jest.mock('../hooks/useProgressiveAudio', () => ({
  useProgressiveAudio: () => ({ playTick: jest.fn(), playCarriageVault: jest.fn() }),
}));

const mockBankGoal = jest.fn(({ targetMinutes, workDays }) => ({
  goalSetAt: '2026-09-20', goalBaseMinutes: 1000, goalPerWorkdayMinutes: 0, goalWorkDays: workDays, targetMinutes,
}));

jest.mock('../contexts/SessionContext', () => ({
  useSession: () => ({
    stats: { goalMinutes: 5500, monthlyMinutes: 1000, dailyMinutes: 50 },
    bankGoal: mockBankGoal,
    updateStat: jest.fn(), // banked/mo correction row
    dailyLog: {},
    goalWorkDays: 28,
    RATE_PER_MINUTE: 0.13,
    arsRate: 1000,
    setArsRate: jest.fn(),
    getMonthResyncPreview: () => ({ sum: 900, pastSum: 850, today: 50 }),
    reconcileMonthTotal: jest.fn(),
  }),
}));

const renderView = () => render(<GoalTrackingView onExit={jest.fn()} />);

describe('GoalTrackingView (v4.113.0)', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('renders pace card with version and a need/workday figure', () => {
    renderView();
    // Version appears in the pace card AND inside the dial header.
    expect(screen.getAllByText(APP_VERSION_LABEL).length).toBeGreaterThan(0);
    const need = document.getElementById('goal-pace-need');
    expect(need).toBeTruthy();
    expect(need.textContent).toMatch(/h\d{2}m/);
  });

  test('pace card uses the dial preview and reacts to frequency change', () => {
    renderView();
    // ANCHORED-GOAL: the dial previews the target you get by banking TODAY
    // (worked 1000m + per-workday commitment × workdays left), not a month quota.
    const expectPace = (goalMins, workDays) => {
      const plan = computeCatchUp({ goalMinutes: goalMins, monthlyMinutes: 1000, dailyMinutes: 50, workDays });
      expect(document.getElementById('goal-pace-need').textContent).toBe(fmtHm(plan.requiredToday));
    };
    // 5500m @ 6.5/wk → 20h/wk → 185m/workday
    expectPace(1000 + 185 * monthBasis({ workDays: 28 }).remainingWorkdays, 28);
    // Switch to 5/Wk (22d/mo): preview goal becomes 1000 + round(1200/5) × workdays left
    fireEvent.click(screen.getByRole('button', { name: /^5\/Wk/i }));
    expectPace(1000 + 240 * monthBasis({ workDays: 22 }).remainingWorkdays, 22);
  });

  test('Bank Goal writes the target + its anchor and stays in the view', () => {
    const onExit = jest.fn();
    render(<GoalTrackingView onExit={onExit} />);
    // v4.162.0: it asks before it writes — the first press only shows the change.
    fireEvent.click(screen.getByRole('button', { name: /Bank Goal:/ }));
    expect(mockBankGoal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Confirm bank/ }));
    // ANCHORED-GOAL: one call carries the target, the per-workday commitment and
    // the base, so the pace clock starts the day it is banked.
    expect(mockBankGoal).toHaveBeenCalledWith(expect.objectContaining({
      targetMinutes: expect.any(Number),
      workDays: 28,
      perWorkdayMinutes: 185,
      baseMinutes: 1000,
    }));
    expect(onExit).not.toHaveBeenCalled();
    expect(document.getElementById('goal-saved-flash')).toBeTruthy();
    expect(document.getElementById('goal-saved-flash').textContent).toMatch(/counts from/i);
  });

  test('Discard undoes the edits and stays in the view (v4.162.0)', () => {
    const onExit = jest.fn();
    render(<GoalTrackingView onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: /Raise weekly commitment/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Discard$/ }));

    expect(onExit).not.toHaveBeenCalled();   // it used to exit the whole view
    expect(mockBankGoal).not.toHaveBeenCalled();
    expect(screen.getByText(/Changes discarded/i)).toBeInTheDocument();
    // the dial is back where it started
    expect(screen.getByRole('button', { name: /Bank Goal:/ })).toBeInTheDocument();
  });

  test('Back to work exits; calendar pane present with clickable today', () => {
    const onExit = jest.fn();
    render(<GoalTrackingView onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: /Back to work/i }));
    expect(onExit).toHaveBeenCalledTimes(1);
    // Calendar pane: month name header renders
    expect(screen.getByText(/📅/)).toBeInTheDocument();
  });
});
