import { render, screen, fireEvent } from '@testing-library/react';
import { MonthCalendarPanel } from './MonthCalendarPanel';

const mockCommitDayToLog = jest.fn();
const mockEditPastDay = jest.fn();

jest.mock('../contexts/SessionContext', () => ({
  useSession: () => ({
    stats: { goalMinutes: 5500, monthlyMinutes: 1000, dailyMinutes: 50 },
    dailyLog: {},
    commitDayToLog: mockCommitDayToLog,
    editPastDay: mockEditPastDay,
    RATE_PER_MINUTE: 0.13,
    arsRate: 1000,
  }),
}));

const today = new Date();

describe('MonthCalendarPanel (v4.113.0)', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('renders month grid with a today cell and workday-basis need line', () => {
    render(<MonthCalendarPanel workDays={28} />);
    expect(screen.getByText(new RegExp(today.toLocaleString('en', { month: 'long' }), 'i'))).toBeInTheDocument();
    expect(document.getElementById(`calendar-day-${today.getDate()}`)).toBeTruthy();
    expect(screen.getByText(/workdays left/i)).toBeInTheDocument();
  });

  test('clicking today opens an inline editor that commits via commitDayToLog', () => {
    render(<MonthCalendarPanel workDays={28} />);
    fireEvent.click(document.getElementById(`calendar-day-${today.getDate()}`));
    const input = document.getElementById(`calendar-day-edit-${today.getDate()}`);
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const todayKey = today.toDateString();
    expect(mockCommitDayToLog).toHaveBeenCalledWith(todayKey, 120);
    expect(mockEditPastDay).not.toHaveBeenCalled();
  });

  test('a past day (when one exists) commits via editPastDay', () => {
    if (today.getDate() < 2) return; // 1st of the month: no past day to click
    render(<MonthCalendarPanel workDays={28} />);
    const pastDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    fireEvent.click(document.getElementById(`calendar-day-${pastDate.getDate()}`));
    const input = document.getElementById(`calendar-day-edit-${pastDate.getDate()}`);
    fireEvent.change(input, { target: { value: '300' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockEditPastDay).toHaveBeenCalledWith(pastDate.toDateString(), 300);
  });

  test('preview goal flags LIVE PREVIEW and shifts the workday need', () => {
    const { rerender } = render(<MonthCalendarPanel workDays={28} />);
    expect(screen.queryByText(/LIVE PREVIEW/i)).not.toBeInTheDocument();
    rerender(<MonthCalendarPanel workDays={28} previewGoalMinutes={9900} />);
    expect(screen.getByText(/LIVE PREVIEW/i)).toBeInTheDocument();
    // 9900 goal − 1000 banked over the 28d-basis workdays left
    expect(screen.getByText(/Need \d+m\/workday for preview goal/i)).toBeInTheDocument();
  });
});
