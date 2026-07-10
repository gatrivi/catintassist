import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConnectInterpretButton } from './ConnectInterpretButton';

describe('ConnectInterpretButton', () => {
  test('Connect button is visible and clickable', async () => {
    jest.useFakeTimers();

    const onSingle = jest.fn();

    render(<ConnectInterpretButton onSingle={onSingle} />);

    const btn = screen.getByRole('button', { name: /connect/i });
    expect(btn).toBeVisible();
    expect(btn).toBeEnabled();

    await userEvent.click(btn);

    // onSingle is delayed via DOUBLE_TAP_MS timeout
    expect(onSingle).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onSingle).toHaveBeenCalledTimes(1);
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
});

