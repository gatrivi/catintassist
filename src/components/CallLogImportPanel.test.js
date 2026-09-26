import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CallLogImportPanel } from './CallLogImportPanel';

// v4.160.0. The operator's most-used control: they often keep transcription
// running past the end of a call, so the app banks minutes the company log
// does not have, and they paste the real rows to correct the day. These cases
// pin the promises the panel makes on that path: SHOW the change first, ask
// twice before overwriting, and give the minutes back on demand.

let mockSession;
jest.mock('../contexts/SessionContext', () => ({ useSession: () => mockSession }));

const pad = (n) => String(n).padStart(2, '0');
const today = new Date();
const TODAY = `${pad(today.getMonth() + 1)}/${pad(today.getDate())}/${today.getFullYear()}`;
const YESTERDAY_DATE = new Date(today.getTime() - 86400000);
const YESTERDAY = `${pad(YESTERDAY_DATE.getMonth() + 1)}/${pad(YESTERDAY_DATE.getDate())}/${YESTERDAY_DATE.getFullYear()}`;
const TODAY_PASTE = [
  `1178\t${TODAY}\t09:35 AM\t10\tYes\tNo\t$0.00`,
  `91316\t${TODAY}\t09:02 AM\t13\tYes\tNo\t$0.00`,
].join('\n');

const setSession = (over = {}) => {
  mockSession = {
    importCallLog: jest.fn(() => ({ days: 1, totalMins: 23, totalCalls: 2, todayOld: 84, todayNew: 23 })),
    undoCallLogImport: jest.fn(() => ({ days: 1, totalMins: 23, totalCalls: 2 })),
    dailyLog: {},
    stats: { dailyMinutes: 84, monthlyMinutes: 900, weeklyMinutes: 300, callsToday: 9 },
    ...over,
  };
  return mockSession;
};

const paste = (text) => fireEvent.change(screen.getByLabelText(/Company call log rows/i), { target: { value: text } });

describe('CallLogImportPanel (v4.160.0)', () => {
  beforeEach(() => {
    localStorage.clear();
    setSession();
  });
  afterEach(() => localStorage.clear());

  test('nothing is written until the operator applies: preview only', () => {
    render(<CallLogImportPanel />);
    paste(TODAY_PASTE);

    // The whole point: the change is visible before it exists.
    expect(screen.getByText('TODAY')).toBeInTheDocument();
    expect(screen.getByText('84m → 23m (-61)')).toBeInTheDocument();
    expect(screen.getByText(/overwrites counted time/i)).toBeInTheDocument();
    expect(mockSession.importCallLog).not.toHaveBeenCalled();
  });

  test('overwrite asks twice, and Cancel writes nothing', () => {
    render(<CallLogImportPanel />);
    paste(TODAY_PASTE);

    fireEvent.click(screen.getByRole('button', { name: /Apply to scoreboard/i }));
    expect(mockSession.importCallLog).not.toHaveBeenCalled(); // first click only asks
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/Removes 61m from the month/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockSession.importCallLog).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  test('confirming applies the parsed day and offers an undo', () => {
    render(<CallLogImportPanel />);
    paste(TODAY_PASTE);

    fireEvent.click(screen.getByRole('button', { name: /Apply to scoreboard/i }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, apply/i }));

    expect(mockSession.importCallLog).toHaveBeenCalledTimes(1);
    const [days] = mockSession.importCallLog.mock.calls[0];
    expect(days).toHaveLength(1);
    expect(days[0].billableMins).toBe(23);
    expect(days[0].dateStr).toBe(new Date().toDateString());
    expect(screen.getByText(/Today 84m → 23m/i)).toBeInTheDocument();
    // The paste is kept so a bad preview can be fixed without re-copying.
    expect(screen.getByLabelText(/Company call log rows/i).value).toContain('1178');
  });

  test('Undo is offered after a paste and restores the previous minutes', () => {
    localStorage.setItem('catintassist_calllog_undo_v1', JSON.stringify({
      savedAt: Date.now() - 120000,
      touched: [new Date().toDateString()],
      prevLog: {},
      prevHistory: {},
      prevStats: { dailyMinutes: 84, monthlyMinutes: 900 },
      summary: { days: 1, totalMins: 23, totalCalls: 2 },
    }));
    render(<CallLogImportPanel />);

    const undo = screen.getByRole('button', { name: /Undo last import/i });
    expect(screen.getByText(/Last paste: 23m over 1 day/i)).toBeInTheDocument();
    fireEvent.click(undo);

    expect(mockSession.undoCallLogImport).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Undone/i)).toBeInTheDocument();
  });

  test('a paste that matches the app is refused instead of silently re-writing', () => {
    setSession({ stats: { dailyMinutes: 23, monthlyMinutes: 900, callsToday: 2 } });
    render(<CallLogImportPanel />);
    paste(TODAY_PASTE);

    expect(screen.getByRole('button', { name: /Apply to scoreboard/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Apply to scoreboard/i }));
    expect(mockSession.importCallLog).not.toHaveBeenCalled();
  });

  test('"Today only" hides other days and says how to see them', () => {
    render(<CallLogImportPanel />);
    paste(`${TODAY_PASTE}\n555\t${YESTERDAY}\t05:10 PM\t30\tYes\tNo\t$0.00`);
    expect(screen.queryByText('TODAY')).toBeInTheDocument();
    expect(screen.getByText(/1 of 1 day\(s\) change/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Today only/i));
    expect(screen.getByText('2 of 2 day(s) change')).toBeInTheDocument();
    expect(screen.getAllByText('TODAY').length).toBe(1);
  });

  test('a paste with no rows for today explains the filter instead of failing silently', () => {
    render(<CallLogImportPanel />);
    paste(`555\t${YESTERDAY}\t05:10 PM\t30\tYes\tNo\t$0.00`);

    expect(screen.getByText(/No valid rows/i)).toBeInTheDocument();
    expect(screen.getByText(/1 other day\(s\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Today only/i));
    expect(screen.getByText(/0m → 30m \(\+30\)/)).toBeInTheDocument();
  });

  test('unreadable rows are listed, not printed as a JSON blob', () => {
    render(<CallLogImportPanel />);
    paste(`${TODAY_PASTE}\ncomplete gibberish line`);

    expect(screen.getByText(/1 row\(s\) not understood/i)).toBeInTheDocument();
    expect(screen.getByText('complete gibberish line')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('"calls"');
  });

  test('Paste from clipboard fills the box, and a blocked clipboard says so', async () => {
    const readText = jest.fn().mockResolvedValue(TODAY_PASTE);
    Object.defineProperty(window.navigator, 'clipboard', { value: { readText }, configurable: true });
    render(<CallLogImportPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Paste from clipboard/i }));
    expect(await screen.findByText(/Pasted from clipboard/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Company call log rows/i).value).toContain('91316');

    readText.mockRejectedValueOnce(new Error('denied'));
    fireEvent.click(screen.getByRole('button', { name: /Paste from clipboard/i }));
    expect(await screen.findByText(/Clipboard blocked/i)).toBeInTheDocument();
  });

  test('the version is visible on the panel so the right build can be confirmed', () => {
    render(<CallLogImportPanel />);
    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeInTheDocument();
  });
});
