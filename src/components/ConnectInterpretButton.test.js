import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConnectInterpretButton } from './ConnectInterpretButton';

describe('ConnectInterpretButton', () => {
  test('Connect button is visible and clickable', async () => {
    const onSingle = jest.fn();

    render(<ConnectInterpretButton onSingle={onSingle} />);

    const btn = screen.getByRole('button', { name: /connect/i });
    expect(btn).toBeVisible();
    expect(btn).toBeEnabled();

    await userEvent.click(btn);

    // Immediate fire — preserves user gesture for getUserMedia on mobile.
    expect(onSingle).toHaveBeenCalledTimes(1);
  });

  test('double-tap calls onDouble', async () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();

    render(<ConnectInterpretButton onSingle={onSingle} onDouble={onDouble} />);

    const btn = screen.getByRole('button', { name: /connect/i });
    await userEvent.click(btn);
    expect(onSingle).toHaveBeenCalledTimes(1);

    await userEvent.click(btn);
    expect(onDouble).toHaveBeenCalledTimes(1);
  });

  test('shares header-chrome-btn base so its box matches STOP/ZAP', () => {
    render(<ConnectInterpretButton onSingle={() => {}} />);
    const btn = screen.getByRole('button', { name: /connect/i });
    expect(btn).toHaveClass('header-chrome-btn');
    expect(btn).toHaveClass('header-accent-connect');
    expect(btn).not.toHaveClass('btn-primaryish');
  });

  test('shows mode icon + robot when provider ready', () => {
    const { rerender } = render(
      <ConnectInterpretButton audioMode="tab" providerReady label="Connect" />
    );
    let btn = screen.getByRole('button', { name: /connect/i });
    expect(btn).toHaveAttribute('data-audio-mode', 'tab');
    expect(btn).toHaveAttribute('data-provider-ready', '1');
    expect(btn.querySelectorAll('svg')).toHaveLength(2);

    rerender(<ConnectInterpretButton audioMode="virtualCable" providerReady label="Connect" />);
    btn = screen.getByRole('button', { name: /connect/i });
    expect(btn).toHaveAttribute('data-audio-mode', 'virtualCable');

    rerender(<ConnectInterpretButton audioMode="mic" providerReady={false} label="Connect" />);
    btn = screen.getByRole('button', { name: /connect/i });
    expect(btn).toHaveAttribute('data-audio-mode', 'mic');
    expect(btn).toHaveAttribute('data-provider-ready', '0');
    expect(btn.querySelectorAll('svg')).toHaveLength(1);
  });

  test('detailed-bar mode renders detailed day progress with readouts, track, and click-to-connect', async () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const segments = [
      { index: 0, type: 'work', left: 10, width: 25, start: Date.now() - 3600000, end: Date.now() - 1800000 },
      { index: 1, type: 'avail', left: 35, width: 15, start: Date.now() - 1800000, end: Date.now() - 900000 },
    ];

    render(
      <ConnectInterpretButton
        size="detailed-bar"
        label="Start interpreting"
        onSingle={onSingle}
        onDouble={onDouble}
        totalOnCallSeconds={5400}
        totalOffCallSeconds={1800}
        compactShiftRemainingSeconds={10800}
        compactWorkdaySegments={segments}
        shiftElapsedRatio={0.45}
        dailyGoal={350}
        totalDailyMins={90}
        providerReady
        audioMode="tab"
      />
    );

    const btn = screen.getByRole('button', { name: /start interpreting/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('connect-interpret-btn--detailed');
    expect(btn).toHaveAttribute('id', 'header-connect-btn');

    // Readouts check
    expect(btn).toHaveTextContent(/ON/);
    expect(btn).toHaveTextContent(/01:30:00/);
    expect(btn).toHaveTextContent(/OFF/);
    expect(btn).toHaveTextContent(/30:00/);
    expect(btn).toHaveTextContent(/LEFT/);
    expect(btn).toHaveTextContent(/03:00:00/);
    expect(btn).toHaveTextContent(/90\/350m/);
    expect(btn).toHaveTextContent(/09:00/);
    expect(btn).toHaveTextContent(/18:00/);

    // Track segments check
    expect(btn.querySelector('.compact-call-goal-meter__segment--work')).toBeInTheDocument();
    expect(btn.querySelector('.compact-call-goal-meter__segment--avail')).toBeInTheDocument();
    expect(btn.querySelector('.compact-call-goal-meter__now')).toBeInTheDocument();

    // Click anywhere on the detailed bar triggers connect
    await userEvent.click(btn);
    expect(onSingle).toHaveBeenCalledTimes(1);
  });
});

