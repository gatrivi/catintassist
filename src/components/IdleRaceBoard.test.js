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
  expect(screen.getByText(/MONTH PACE GAP/)).toBeInTheDocument();
  expect(screen.getByText(/month-to-date/)).toBeInTheDocument();
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

test('renders unreachable indication when daily need exceeds 24 hours', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-24T12:00:00'));
  try {
    // Nov 24, 220h goal with only 2692m banked and 6.5 workdays left -> ~26h 57m/d
    jest.spyOn(Session, 'useSession').mockReturnValue({
      stats: { goalMinutes: 13200, monthlyMinutes: 2692, dailyMinutes: 41 },
      dailyLog: {},
      goalWorkDays: 28,
    });
    render(<IdleRaceBoard />);
    expect(screen.getByText(/>24h \/ day/)).toBeInTheDocument();
    expect(screen.getByText(/Out of reach/)).toBeInTheDocument();
    const raceTab = screen.getByRole('button', { name: /Pace Race/ });
    fireEvent.click(raceTab);
    expect(screen.getByText(/Goal unreachable: requires/)).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

test('renders nothing without a goal (never a broken panel)', () => {
  jest.spyOn(Session, 'useSession').mockReturnValue({ stats: {}, dailyLog: {}, goalWorkDays: 0 });
  const { container } = render(<IdleRaceBoard />);
  expect(container).toBeEmptyDOMElement();
});
