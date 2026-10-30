import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SttStallBanner } from './SttStallBanner';

describe('SttStallBanner (v4.201.0)', () => {
  test('renders null when reason is null', () => {
    const { container } = render(<SttStallBanner reason={null} onZap={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders stall warning, ZAP button, and 1-tap Copy Log button', () => {
    const onZap = jest.fn();
    render(<SttStallBanner reason="no-reply" onZap={onZap} />);

    expect(screen.getByText(/Transcription stopped — Deepgram not answering/)).toBeInTheDocument();
    const zapBtn = screen.getByRole('button', { name: /ZAP/i });
    expect(zapBtn).toBeInTheDocument();
    fireEvent.click(zapBtn);
    expect(onZap).toHaveBeenCalledTimes(1);

    const copyBtn = screen.getByRole('button', { name: /Copy incident diagnostic log/i });
    expect(copyBtn).toHaveTextContent('📋 Copy Log');

    window.__CAT_INCIDENT = jest.fn();
    fireEvent.click(copyBtn);
    expect(window.__CAT_INCIDENT).toHaveBeenCalledTimes(1);
    expect(copyBtn).toHaveTextContent('Copied ✓');
  });
});
