import { render, screen, fireEvent } from '@testing-library/react';
import { DailyTargetsChip } from './DailyTargetsChip';

beforeAll(() => {
  if (typeof window !== 'undefined' && !window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe('DailyTargetsChip goal-button (v4.113.0)', () => {
  test('acts as a button when onOpenGoalsView is wired', () => {
    const open = jest.fn();
    render(
      <DailyTargetsChip dailyMinutes={53} monthlyMinutes={880} breakMinutes={10} goalMinutes={5500} onOpenGoalsView={open} />,
    );
    const chip = screen.getByRole('button');
    expect(chip.getAttribute('title')).toMatch(/goal tracking/i);
    fireEvent.click(chip);
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('stays a plain strip without handler', () => {
    render(<DailyTargetsChip dailyMinutes={53} monthlyMinutes={880} breakMinutes={10} goalMinutes={5500} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
