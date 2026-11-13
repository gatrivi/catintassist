import React from 'react';
import { render, screen } from '@testing-library/react';
import { IdleRaceBoard } from './IdleRaceBoard';
import * as Session from '../contexts/SessionContext';

afterEach(() => jest.restoreAllMocks());

test('renders the gap number and MO AVG when a goal exists', () => {
  jest.spyOn(Session, 'useSession').mockReturnValue({
    stats: { goalMinutes: 13200, monthlyMinutes: 1032, dailyMinutes: 0 },
    dailyLog: {},
    goalWorkDays: 22,
  });
  render(<IdleRaceBoard />);
  expect(screen.getByText(/MO AVG/)).toBeInTheDocument();
  expect(screen.getByText(/DAILY NEED/)).toBeInTheDocument();
  expect(screen.getByText(/PACE GAP/)).toBeInTheDocument();
  expect(screen.getByText(/MONTH PROGRESS/)).toBeInTheDocument();
  expect(screen.getByLabelText(/Month pace/)).toBeInTheDocument();
});

test('renders nothing without a goal (never a broken panel)', () => {
  jest.spyOn(Session, 'useSession').mockReturnValue({ stats: {}, dailyLog: {}, goalWorkDays: 0 });
  const { container } = render(<IdleRaceBoard />);
  expect(container).toBeEmptyDOMElement();
});
