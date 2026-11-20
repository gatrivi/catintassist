import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { IdleRaceBoard } from './IdleRaceBoard';
import * as Session from '../contexts/SessionContext';

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

test('renders heroes and default emoji calendar when a goal exists', () => {
  jest.spyOn(Session, 'useSession').mockReturnValue({
    stats: { goalMinutes: 13200, monthlyMinutes: 1032, dailyMinutes: 0 },
    dailyLog: {},
    goalWorkDays: 22,
  });
  render(<IdleRaceBoard />);
  expect(screen.getByText(/DAILY NEED/)).toBeInTheDocument();
  expect(screen.getByText(/PACE GAP/)).toBeInTheDocument();
  expect(screen.getByText(/MONTH PROGRESS/)).toBeInTheDocument();
  expect(screen.getByText(/Calendar \(50m Emojis\)/)).toBeInTheDocument();
});

test('can switch to race track view and see MO AVG and stats', () => {
  jest.spyOn(Session, 'useSession').mockReturnValue({
    stats: { goalMinutes: 13200, monthlyMinutes: 1032, dailyMinutes: 0 },
    dailyLog: {},
    goalWorkDays: 22,
  });
  render(<IdleRaceBoard />);
  const raceTab = screen.getByRole('button', { name: /Pace Race/ });
  fireEvent.click(raceTab);
  expect(screen.getByText(/MO AVG/)).toBeInTheDocument();
});

test('renders nothing without a goal (never a broken panel)', () => {
  jest.spyOn(Session, 'useSession').mockReturnValue({ stats: {}, dailyLog: {}, goalWorkDays: 0 });
  const { container } = render(<IdleRaceBoard />);
  expect(container).toBeEmptyDOMElement();
});
