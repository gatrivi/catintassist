import React from 'react';
import { render, screen } from '@testing-library/react';
import { IdleMonthCalendar } from './IdleMonthCalendar';
import * as Session from '../contexts/SessionContext';

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

describe('IdleMonthCalendar', () => {
  test('renders month title and days of week', () => {
    jest.spyOn(Session, 'useSession').mockReturnValue({
      stats: { goalMinutes: 5500, monthlyMinutes: 1000, dailyMinutes: 150 },
      dailyLog: {},
      goalWorkDays: 28,
    });

    render(<IdleMonthCalendar />);
    expect(screen.getByText(/Mon/)).toBeInTheDocument();
    expect(screen.getByText(/Fri/)).toBeInTheDocument();
    expect(screen.getByText(/Solid = 50m done/)).toBeInTheDocument();
    expect(screen.getByText(/Faded = 50m to do/)).toBeInTheDocument();
  });

  test('renders today with solid and faded emoji blocks according to worked minutes', () => {
    jest.spyOn(Session, 'useSession').mockReturnValue({
      stats: { goalMinutes: 5500, monthlyMinutes: 1000, dailyMinutes: 150 }, // 150m = 3 blocks done
      dailyLog: {},
      goalWorkDays: 28,
    });

    const { container } = render(<IdleMonthCalendar />);
    const todayCell = container.querySelector('.idle-calendar__cell--today');
    expect(todayCell).toBeInTheDocument();
    
    const doneEmojis = todayCell.querySelectorAll('.idle-emoji--done');
    const todoEmojis = todayCell.querySelectorAll('.idle-emoji--todo');
    expect(doneEmojis.length).toBe(3); // 150m / 50m = 3 done
    expect(todoEmojis.length).toBeGreaterThanOrEqual(1); // remaining blocks
  });
});
