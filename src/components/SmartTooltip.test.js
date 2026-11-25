import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SmartTooltip } from './SmartTooltip';

describe('SmartTooltip (v4.223.0)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('does not show tooltip immediately on hover (respects delay)', () => {
    render(
      <SmartTooltip
        title="DAILY NEED"
        formula="1000m ÷ 10d = 100m/d"
        desc="Daily average needed"
        delay={250}
      >
        <button type="button">Hover Target</button>
      </SmartTooltip>
    );

    const target = screen.getByRole('button', { name: 'Hover Target' });
    fireEvent.mouseEnter(target);

    // After 100ms, still hidden
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // After 250ms total, appears
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('DAILY NEED')).toBeInTheDocument();
    expect(screen.getByText('1000m ÷ 10d = 100m/d')).toBeInTheDocument();
    expect(screen.getByText('Daily average needed')).toBeInTheDocument();
  });

  test('cancels tooltip if mouse leaves before delay', () => {
    render(
      <SmartTooltip title="PACE GAP" desc="Gap explanation" delay={250}>
        <button type="button">Target</button>
      </SmartTooltip>
    );

    const target = screen.getByRole('button', { name: 'Target' });
    fireEvent.mouseEnter(target);
    act(() => {
      jest.advanceTimersByTime(150);
    });
    fireEvent.mouseLeave(target);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('hides on Escape key', () => {
    render(
      <SmartTooltip title="MONTH PROGRESS" desc="Progress explanation" delay={100}>
        <button type="button">Target</button>
      </SmartTooltip>
    );

    const target = screen.getByRole('button', { name: 'Target' });
    fireEvent.mouseEnter(target);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
