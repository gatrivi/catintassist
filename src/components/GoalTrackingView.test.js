import { render, screen, fireEvent } from '@testing-library/react';
import { GoalTrackingView } from './GoalTrackingView';
import { computeCatchUp, fmtHm } from '../utils/catchUpPlan';
import { APP_VERSION_LABEL } from '../constants/version';

jest.mock('../hooks/useProgressiveAudio', () => ({
  useProgressiveAudio: () => ({ playTick: jest.fn(), playCarriageVault: jest.fn() }),
}));

const mockUpdateStat = jest.fn();
const mockSetGoalWorkDays = jest.fn();

jest.mock('../contexts/SessionContext', () => ({
  useSession: () => ({
    stats: { goalMinutes: 5500, monthlyMinutes: 1000, dailyMinutes: 50 },
    updateStat: mockUpdateStat,
    dailyLog: {},
    goalWorkDays: 28,
    setGoalWorkDays: mockSetGoalWorkDays,
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
    // Mount: dial snaps 5500m @ 6.5/wk → 20h/wk → round(round(1200/6.5)*28) = 5180m/mo preview
    const expectPace = (goalMins, workDays) => {
      const plan = computeCatchUp({ goalMinutes: goalMins, monthlyMinutes: 1000, dailyMinutes: 50, workDays });
      expect(document.getElementById('goal-pace-need').textContent).toBe(fmtHm(plan.requiredToday));
    };
    expectPace(5180, 28);
    // Switch to 5/Wk (22d/mo): preview goal becomes round(1200/5)*22 = 5280
    fireEvent.click(screen.getByRole('button', { name: /^5\/Wk/i }));
    expectPace(5280, 22);
  });

  test('Bank Goal persists goalMinutes + workDays and stays in the view', () => {
    const onExit = jest.fn();
    render(<GoalTrackingView onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: /Bank Goal:/ }));
    expect(mockUpdateStat).toHaveBeenCalledWith('goalMinutes', expect.any(Number));
    expect(mockSetGoalWorkDays).toHaveBeenCalledWith(28);
    expect(onExit).not.toHaveBeenCalled();
    expect(document.getElementById('goal-saved-flash')).toBeTruthy();
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
