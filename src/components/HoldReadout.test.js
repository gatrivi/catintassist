import { render, screen } from '@testing-library/react';
import { HoldReadout } from './HoldReadout';

describe('HoldReadout (HUD end of hold counter)', () => {
  it('renders nothing when not on hold', () => {
    const { container } = render(<HoldReadout isHold={false} holdSeconds={99} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows H only while on hold (uniform 23px cell; time in aria)', () => {
    render(<HoldReadout isHold holdSeconds={0} />);
    expect(screen.getByText('H')).toBeInTheDocument();
  });

  it('formats 95s as H 01:35', () => {
    render(<HoldReadout isHold holdSeconds={95} />);
    expect(screen.getByLabelText(/on hold 01:35 elapsed/i)).toBeInTheDocument();
  });

  it('never leaks NaN/negative into the HUD', () => {
    const { rerender } = render(<HoldReadout isHold holdSeconds={NaN} />);
    expect(screen.getByLabelText(/on hold 00:00 elapsed/i)).toBeInTheDocument();
    rerender(<HoldReadout isHold holdSeconds={-12} />);
    expect(screen.getByLabelText(/on hold 00:00 elapsed/i)).toBeInTheDocument();
  });
});
