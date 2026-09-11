import { render, screen, fireEvent } from '@testing-library/react';
import { DialGoalSelector, WORK_DAY_OPTS, daysPerWeekOf } from './DialGoalSelector';
import { APP_VERSION_LABEL } from '../constants/version';

jest.mock('../hooks/useProgressiveAudio', () => ({
  useProgressiveAudio: () => ({ playTick: jest.fn(), playCarriageVault: jest.fn() }),
}));

const baseProps = {
  ratePerMinute: 0.13,
  arsRate: 1000,
  setArsRate: jest.fn(),
  initialGoalMinutes: 5500,
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

describe('DialGoalSelector rehab (v4.100.0)', () => {
  test('workday options include 6.5/Wk (28d) and map correctly', () => {
    expect(WORK_DAY_OPTS.some((o) => o.val === 28 && o.perWk === 6.5)).toBe(true);
    expect(daysPerWeekOf(28)).toBe(6.5);
    expect(daysPerWeekOf(22)).toBe(5);
    expect(daysPerWeekOf(26)).toBe(6);
    expect(daysPerWeekOf(30)).toBe(7);
  });

  test('shows version tag and catch-up preview', () => {
    render(<DialGoalSelector {...baseProps} monthlyMinutes={1000} dailyMinutes={50} />);
    expect(screen.getByText(APP_VERSION_LABEL)).toBeInTheDocument();
    // behind pace preview (goal 5500-ish dial vs 1000 banked → behind)
    expect(screen.getByText(/behind|ahead|on pace/i)).toBeInTheDocument();
  });

  test('step buttons move the dial and Bank Goal label follows', () => {
    render(<DialGoalSelector {...baseProps} monthlyMinutes={1000} dailyMinutes={50} />);
    const btn = screen.getByRole('button', { name: /Bank Goal:/ });
    const before = btn.textContent;
    fireEvent.click(screen.getByRole('button', { name: /Raise weekly commitment/i }));
    expect(screen.getByRole('button', { name: /Bank Goal:/ }).textContent).not.toBe(before);
  });

  test('custom monthly input overrides the bank goal', () => {
    render(<DialGoalSelector {...baseProps} monthlyMinutes={1000} dailyMinutes={50} />);
    fireEvent.change(screen.getByLabelText(/Monthly goal minutes/i), { target: { value: '9200' } });
    expect(screen.getByRole('button', { name: /Bank Goal: 9200m\/Mo/ })).toBeInTheDocument();
  });

  test('onSave carries workdays meta; month correction row when wired', () => {
    const onSave = jest.fn();
    const onSaveMonth = jest.fn();
    render(
      <DialGoalSelector
        {...baseProps}
        onSave={onSave}
        monthlyMinutes={1000}
        dailyMinutes={50}
        onSaveMonth={onSaveMonth}
        onResyncMonth={jest.fn()}
        resyncInfo={{ sum: 1234 }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Bank Goal:/ }));
    expect(onSave).toHaveBeenCalledWith(expect.any(Number), expect.objectContaining({ workDays: 22 }));
    fireEvent.change(screen.getByLabelText(/Banked month total/i), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /^Set$/ }));
    expect(onSaveMonth).toHaveBeenCalledWith(1234);
    expect(screen.getByRole('button', { name: /log=1234m/ })).toBeInTheDocument();
  });
});
