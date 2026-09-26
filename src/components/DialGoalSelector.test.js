import { render, screen, fireEvent } from '@testing-library/react';
import { DialGoalSelector, WORK_DAY_OPTS, daysPerWeekOf } from './DialGoalSelector';
import { monthBasis } from '../utils/catchUpPlan';
import { APP_VERSION_LABEL } from '../constants/version';

jest.mock('../hooks/useProgressiveAudio', () => ({
  useProgressiveAudio: () => ({ playTick: jest.fn(), playCarriageVault: jest.fn() }),
}));

const baseProps = {
  ratePerMinute: 0.13,
  arsRate: 1000,
  initialGoalMinutes: 5500,
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

/**
 * v4.162.0: Bank Goal now asks first. Pressing it once arms it and shows the
 * change; pressing again writes. Every test that expects a write must arm it.
 */
const bankGoal = () => {
  fireEvent.click(screen.getByRole('button', { name: /Bank Goal|Confirm bank/ }));
  fireEvent.click(screen.getByRole('button', { name: /Bank Goal|Confirm bank/ }));
};

describe('DialGoalSelector rehab (v4.100.0)', () => {
  test('workday options include 6.5/Wk (28d) and map correctly', () => {
    expect(WORK_DAY_OPTS.some((o) => o.val === 28 && o.perWk === 6.5)).toBe(true);
    expect(daysPerWeekOf(28)).toBe(6.5);
    expect(daysPerWeekOf(22)).toBe(5);
    expect(daysPerWeekOf(26)).toBe(6);
    expect(daysPerWeekOf(30)).toBe(7);
  });

  test('shows version tag and catch-up preview', () => {
    render(<DialGoalSelector {...baseProps} monthlyMinutes={1000} dailyMinutes={50} />);
    expect(screen.getByText(APP_VERSION_LABEL)).toBeInTheDocument();
    // behind pace preview (goal 5500-ish dial vs 1000 banked → behind)
    expect(screen.getByText(/behind|ahead|on pace/i)).toBeInTheDocument();
  });

  test('step buttons move the dial and Bank Goal label follows', () => {
    render(<DialGoalSelector {...baseProps} monthlyMinutes={1000} dailyMinutes={50} />);
    const btn = screen.getByRole('button', { name: /Bank Goal:/ });
    const before = btn.textContent;
    fireEvent.click(screen.getByRole('button', { name: /Raise weekly commitment/i }));
    expect(screen.getByRole('button', { name: /Bank Goal:/ }).textContent).not.toBe(before);
  });

  test('custom monthly input overrides the bank goal', () => {
    render(<DialGoalSelector {...baseProps} monthlyMinutes={1000} dailyMinutes={50} />);
    fireEvent.change(screen.getByLabelText(/Monthly goal minutes/i), { target: { value: '9200' } });
    expect(screen.getByRole('button', { name: /Bank Goal: 9200m\/Mo/ })).toBeInTheDocument();
  });

  test('onSave carries workdays meta; month correction row when wired', () => {
    const onSave = jest.fn();
    const onSaveMonth = jest.fn();
    render(
      <DialGoalSelector
        {...baseProps}
        onSave={onSave}
        monthlyMinutes={1000}
        dailyMinutes={50}
        onSaveMonth={onSaveMonth}
        onResyncMonth={jest.fn()}
        resyncInfo={{ sum: 1234 }}
      />,
    );
    bankGoal();
    expect(onSave).toHaveBeenCalledWith(expect.any(Number), expect.objectContaining({ workDays: 28 }));
    fireEvent.change(screen.getByLabelText(/Banked month total/i), { target: { value: '1234' } });
    // The Set button arms first (v4.162.0), then writes.
    fireEvent.click(screen.getByRole('button', { name: /^Set$/ }));
    expect(onSaveMonth).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Confirm\?$/ }));
    expect(onSaveMonth).toHaveBeenCalledWith(1234);
    expect(screen.getByRole('button', { name: /log=1234m/ })).toBeInTheDocument();
  });

  test('onPreview fires on mount and follows dial/frequency changes (v4.113.0)', () => {
    const onPreview = jest.fn();
    render(<DialGoalSelector {...baseProps} initialWorkDays={28} monthlyMinutes={1000} dailyMinutes={50} onPreview={onPreview} />);
    // ANCHORED-GOAL: the banked target is derived FORWARD from today:
    // worked so far (1000) + per-workday commitment × workdays left.
    // 5500m @ 6.5/wk snaps to 20h/wk → daily = round(1200/6.5) = 185m
    const left = monthBasis({ workDays: 28 }).remainingWorkdays;
    expect(onPreview).toHaveBeenLastCalledWith({ monthlyMinutes: 1000 + 185 * left, workDays: 28, daysPerWeek: 6.5 });
    fireEvent.click(screen.getByRole('button', { name: /Raise weekly commitment/i }));
    // 25h/wk @ 6.5 → round(1500/6.5) = 231m/workday
    expect(onPreview).toHaveBeenLastCalledWith({ monthlyMinutes: 1000 + 231 * left, workDays: 28, daysPerWeek: 6.5 });
    fireEvent.click(screen.getByRole('button', { name: /^5\/Wk/i }));
    // 25h/wk @ 5d/wk (22d/mo) → 300m/workday over the 22d-basis workdays left
    const left22 = monthBasis({ workDays: 22 }).remainingWorkdays;
    expect(onPreview).toHaveBeenLastCalledWith({ monthlyMinutes: 1000 + 300 * left22, workDays: 22, daysPerWeek: 5 });
  });

  test('bank payload carries the anchor inputs (ANCHORED-GOAL)', () => {
    const onSave = jest.fn();
    render(<DialGoalSelector {...baseProps} onSave={onSave} monthlyMinutes={1000} dailyMinutes={50} />);
    bankGoal();
    const [target, meta] = onSave.mock.calls[0];
    const left = monthBasis({ workDays: 28 }).remainingWorkdays;
    expect(target).toBe(1000 + 185 * left);          // worked + commitment × workdays left
    expect(meta.perWorkdayMinutes).toBe(185);        // commitment kept for next month
    expect(meta.baseMinutes).toBe(1000);             // deficit starts at 0 when banked
    expect(meta.workDays).toBe(28);
    expect(meta.fullMonthMinutes).toBe(185 * 28);    // full-month equivalent stays visible
  });

  test('preview is honest mid-month: banked goal reads on pace, not months behind', () => {
    const { container } = render(<DialGoalSelector {...baseProps} initialWorkDays={22} monthlyMinutes={1000} dailyMinutes={50} />);
    // 5500m @ 5/wk → 20h/wk → 240m/workday; the target only covers workdays left
    const left = monthBasis({ workDays: 22 }).remainingWorkdays;
    expect(screen.getByText(/on pace|ahead/i)).toBeInTheDocument();
    // what gets banked, and why
    expect(container.textContent).toContain(`banked goal ${1000 + 240 * left}m`);
    expect(container.textContent).toContain('worked 16h40m');
    expect(container.textContent).toContain(`${left} workdays × 4h00m`);
    // full-month equivalent stays discoverable
    expect(container.textContent).toContain('full month @ 22d basis: 5280m');
  });
});

// FOLLOW-UP DEFECT: `goalMinutes` is now a MID-MONTH total (worked so far +
// commitment × workdays left), so nothing may reverse-derive the commitment from
// it. These tests bank mid-month and re-open the configurator.
describe('banked commitment survives a re-open (ANCHORED-GOAL follow-up)', () => {
  const WORKDAYS = 22;        // 5/Wk basis
  const PER_WORKDAY = 420;    // 35h/Wk ÷ 5 d/wk
  const CUSTOM_PER_WORKDAY = 1145;   // 95.4h/Wk: between dial rows, so nearest-row rounding is exercised
  const left = () => monthBasis({ workDays: WORKDAYS }).remainingWorkdays;
  const bankedTotal = () => PER_WORKDAY * left(); // worked so far (0) + commitment × workdays left

  test('dial + ladder come back on the 35h/Wk commitment that was banked', () => {
    const onPreview = jest.fn();
    const { container } = render(
      <DialGoalSelector
        {...baseProps}
        initialGoalMinutes={bankedTotal()}
        initialWorkDays={WORKDAYS}
        monthlyMinutes={0}
        dailyMinutes={0}
        onPreview={onPreview}
        committedPerWorkdayMinutes={PER_WORKDAY}
        committedWorkDays={WORKDAYS}
      />,
    );
    // The bank target is still the commitment × workdays left (NOT the 20h/Wk row
    // that the prorated total ÷ 22d reverse-derives to: 240m/d × left).
    expect(onPreview).toHaveBeenLastCalledWith({ monthlyMinutes: bankedTotal(), workDays: WORKDAYS, daysPerWeek: 5 });
    // ... and the button offers that same total, never a smaller one.
    expect(screen.getByRole('button', { name: `Bank Goal: ${bankedTotal()}m/Mo` })).toBeInTheDocument();
    // The ladder badge describes the COMMITMENT's monthly ambition (9240m/mo),
    // matching the sentence right below it — not the prorated mid-month number.
    expect(container.textContent).toContain('At 35h/Wk × 5d/wk');
    expect(container.textContent).toContain('in a full month (9240m)');
    expect(container.textContent).toContain('🪜 Step Achiever (Floor)');
    expect(container.textContent).toContain('[The Pro Ladder: Step 6/12]');
    expect(container.textContent).not.toContain('Training Mode');
  });

  test('a banked CUSTOM month total comes back as the commitment it implied', () => {
    const onPreview = jest.fn();
    render(
      <DialGoalSelector
        {...baseProps}
        initialGoalMinutes={CUSTOM_PER_WORKDAY * left()}
        initialWorkDays={WORKDAYS}
        monthlyMinutes={0}
        dailyMinutes={0}
        onPreview={onPreview}
        // what the dial stores for a custom total: the per-workday value it implies
        committedPerWorkdayMinutes={CUSTOM_PER_WORKDAY}
        committedWorkDays={WORKDAYS}
      />,
    );
    // 1145m/workday -> 95.4h/Wk -> nearest dial row 95h/Wk (1140m/d), whatever the date.
    expect(onPreview).toHaveBeenLastCalledWith({ monthlyMinutes: 1140 * left(), workDays: WORKDAYS, daysPerWeek: 5 });
  });

  test('a custom total past the dial range clamps to the top row (documented limit)', () => {
    const onPreview = jest.fn();
    render(
      <DialGoalSelector
        {...baseProps}
        initialGoalMinutes={2000 * left()}
        initialWorkDays={WORKDAYS}
        monthlyMinutes={0}
        dailyMinutes={0}
        onPreview={onPreview}
        // 2000m/workday = 166.7h/Wk, far past the dial's 100h/Wk top row
        committedPerWorkdayMinutes={2000}
        committedWorkDays={WORKDAYS}
      />,
    );
    // Clamps to 100h/Wk (1200m/d) instead of inventing a row that does not exist.
    expect(onPreview).toHaveBeenLastCalledWith({ monthlyMinutes: 1200 * left(), workDays: WORKDAYS, daysPerWeek: 5 });
  });

  test('legacy stats without a stored commitment keep the old derivation', () => {
    const onPreview = jest.fn();
    render(
      <DialGoalSelector {...baseProps} initialGoalMinutes={6000} initialWorkDays={WORKDAYS} monthlyMinutes={0} dailyMinutes={0} onPreview={onPreview} />,
    );
    // 6000m ÷ 22d = 273m/d → 22.75h/Wk → nearest row 25h/Wk → 300m/d
    expect(onPreview).toHaveBeenLastCalledWith({ monthlyMinutes: 300 * left(), workDays: WORKDAYS, daysPerWeek: 5 });
  });
});

// v4.162.0 — every number in this panel is money you get paid on. These cases
// pin the guards: nothing is written without showing the change and asking
// once, an emptied box is not a request to zero the month, and the arrow keys
// never eat what you are typing.
describe('goal dial money safety (v4.162.0)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const withMonthRow = (extra = {}) => render(
    <DialGoalSelector
      {...baseProps}
      monthlyMinutes={1000}
      dailyMinutes={50}
      onSaveMonth={jest.fn()}
      onResyncMonth={jest.fn()}
      resyncInfo={{ sum: 1234 }}
      {...extra}
    />,
  );

  test('an EMPTIED banked/mo box refuses to write instead of zeroing the month', () => {
    const onSaveMonth = jest.fn();
    withMonthRow({ onSaveMonth });
    const input = screen.getByLabelText(/Banked month total/i);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^Set$/ }));

    expect(onSaveMonth).not.toHaveBeenCalled();
    expect(screen.getByText(/Type a number of minutes first/i)).toBeInTheDocument();
  });

  test('a negative or junk banked/mo value is refused too', () => {
    const onSaveMonth = jest.fn();
    withMonthRow({ onSaveMonth });
    const input = screen.getByLabelText(/Banked month total/i);
    ['-5', 'abc'].forEach((bad) => {
      fireEvent.change(input, { target: { value: bad } });
      fireEvent.click(screen.getByRole('button', { name: /^Set$/ }));
      expect(onSaveMonth).not.toHaveBeenCalled();
    });
  });

  test('Set shows the change and writes only on the second press', () => {
    const onSaveMonth = jest.fn();
    withMonthRow({ onSaveMonth });
    fireEvent.change(screen.getByLabelText(/Banked month total/i), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: /^Set$/ }));

    expect(onSaveMonth).not.toHaveBeenCalled();
    expect(screen.getByText(/1000m → 5000m \(\+4000\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Confirm\?$/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Confirm\?$/ }));
    expect(onSaveMonth).toHaveBeenCalledWith(5000);
  });

  test('re-sum asks before it can LOWER the month, then writes', () => {
    const onResyncMonth = jest.fn();
    withMonthRow({ onResyncMonth, resyncInfo: { sum: 300 } });
    fireEvent.click(screen.getByRole('button', { name: /log=300m/ }));

    expect(onResyncMonth).not.toHaveBeenCalled();
    expect(screen.getByText(/1000m → 300m \(-700\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Confirm\?$/ }));
    expect(onResyncMonth).toHaveBeenCalledTimes(1);
  });

  test('Bank Goal shows old → new before committing five fields', () => {
    const onSave = jest.fn();
    render(<DialGoalSelector {...baseProps} onSave={onSave} initialGoalMinutes={5500} monthlyMinutes={1000} dailyMinutes={50} />);
    fireEvent.click(screen.getByRole('button', { name: /Bank Goal:/ }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Bank goal: 5500m →/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirm bank/ }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  test('an existing snapshot is offered as Undo when the panel opens', () => {
    localStorage.setItem('catint_stat_undo_v1', JSON.stringify({
      label: 're-sum month', savedAt: Date.now(), stats: { monthlyMinutes: 4242 },
    }));
    const onUndoStat = jest.fn(() => ({ monthlyMinutes: 4242 }));
    withMonthRow({ onUndoStat });

    expect(screen.getByText(/Last change: re-sum month/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Undo it/ }));
    expect(onUndoStat).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/back to 4242m/)).toBeInTheDocument();
  });

  test('Undo with nothing left to restore says so instead of pretending', () => {
    localStorage.setItem('catint_stat_undo_v1', JSON.stringify({
      label: 're-sum month', savedAt: Date.now(), stats: { monthlyMinutes: 4242 },
    }));
    // The snapshot was consumed by something else between mount and click.
    const onUndoStat = jest.fn(() => null);
    withMonthRow({ onUndoStat });
    fireEvent.click(screen.getByRole('button', { name: /Undo it/ }));
    expect(onUndoStat).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Nothing left to undo/i)).toBeInTheDocument();
  });

  // The bug this exists for: the keydown handler sat on the wrapper, so ↑/↓
  // in the monthly field moved the dial AND cleared the typed override.
  test('arrow keys inside the monthly field do not wipe what you are typing', () => {
    const onPreview = jest.fn();
    render(
      <DialGoalSelector
        {...baseProps}
        monthlyMinutes={1000}
        dailyMinutes={50}
        onPreview={onPreview}
      />,
    );
    const input = screen.getByLabelText(/Monthly goal minutes/i);
    fireEvent.change(input, { target: { value: '9200' } });
    const before = onPreview.mock.calls[onPreview.mock.calls.length - 1][0];
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(input.value).toBe('9200');
    expect(onPreview.mock.calls[onPreview.mock.calls.length - 1][0]).toEqual(before);
  });

  test('arrow keys still move the dial when nothing is being typed', () => {
    const onPreview = jest.fn();
    const { container } = render(
      <DialGoalSelector {...baseProps} monthlyMinutes={1000} dailyMinutes={50} onPreview={onPreview} />,
    );
    const before = container.textContent;
    // The dial opens on the 20h/Wk row (index 0), so step DOWN to move it.
    fireEvent.keyDown(container.querySelector('[role="dialog"]'), { key: 'ArrowDown' });
    expect(container.textContent).not.toBe(before);
  });

  // App.js also listens for Escape to leave the goals view; without stopPropagation
  // one keypress fired both handlers.
  test('Escape does not also reach the window-level handler', () => {
    const onCancel = jest.fn();
    const onWindowEscape = jest.fn();
    window.addEventListener('keydown', onWindowEscape);
    const { container } = render(
      <DialGoalSelector {...baseProps} onCancel={onCancel} monthlyMinutes={1000} dailyMinutes={50} />,
    );
    // stopPropagation only stops bubbling, so assert on the same-node behaviour:
    // the dial handled it exactly once and the event did not reach window.
    const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    container.querySelector('[role="dialog"]').dispatchEvent(evt);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onWindowEscape).not.toHaveBeenCalled();
    window.removeEventListener('keydown', onWindowEscape);
  });

  test('the ARS rate is read-only with a refresh, not an editable field', () => {
    const onRefreshArs = jest.fn();
    render(
      <DialGoalSelector
        {...baseProps}
        arsRate={1042.5}
        arsRateFetchedAt={Date.UTC(2026, 8, 26, 15, 22)}
        onRefreshArs={onRefreshArs}
        monthlyMinutes={1000}
        dailyMinutes={50}
      />,
    );
    expect(screen.getByText('1.043')).toBeInTheDocument(); // es-AR grouping
    expect(screen.getByText(/live/)).toBeInTheDocument();
    // No number input for the rate any more: it is a live feed, not a setting.
    expect(document.querySelector('input[type="number"][step="any"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Refresh the ARS exchange rate/ }));
    expect(onRefreshArs).toHaveBeenCalledTimes(1);
  });

  test('the dialog is labelled and the version is on it', () => {
    const { container } = render(<DialGoalSelector {...baseProps} monthlyMinutes={1000} dailyMinutes={50} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-label')).toContain(APP_VERSION_LABEL);
    expect(document.getElementById('goal-config-version-pill')).toBeTruthy();
  });
});
