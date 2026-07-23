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

