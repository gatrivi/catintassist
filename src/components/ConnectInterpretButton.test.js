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
});

