import React from 'react';

export const OFF_CALL_VIEWS = ['scoreboard', 'soundboard'];

const VIEW_META = {
  scoreboard: { label: 'Scoreboard', next: 'Soundboard Studio' },
  soundboard: { label: 'Soundboard Studio', next: 'Scoreboard' },
};

/** Art-deco studio icon — pyramid + tier lines; center gem marks soundboard mode. */
const StudioIcon = ({ view }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M12 2 L20 8 L17 22 H7 L4 8 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="miter"
    />
    <path
      d="M8 10 H16 M9 14 H15 M10 18 H14"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="square"
      opacity={view === 'scoreboard' ? 1 : 0.35}
    />
    <circle
      cx="12"
      cy="7"
      r="2.2"
      fill={view === 'soundboard' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1"
    />
    <path d="M12 2 V5" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
    <path d="M4 8 L7 10 M20 8 L17 10" stroke="currentColor" strokeWidth="0.8" opacity="0.45" />
  </svg>
);

export const WorkspaceViewSwitcher = ({
  view = 'scoreboard',
  onCycle,
  disabled = false,
  variant = 'inline',
  showHint = false,
}) => {
  const meta = VIEW_META[view] || VIEW_META.scoreboard;
  const hintActive = showHint && view === 'scoreboard' && !disabled;

  return (
    <button
      type="button"
      className={[
        'workspace-view-btn',
        `workspace-view-btn--${variant}`,
        disabled ? 'is-disabled' : '',
        hintActive ? 'workspace-view-btn--hint' : '',
      ].filter(Boolean).join(' ')}
      onClick={onCycle}
      disabled={disabled}
      title={
        disabled
          ? 'Studio switch — off-call only'
          : hintActive
            ? `Try Soundboard Studio · ${meta.next}`
            : `${meta.label} · click → ${meta.next}`
      }
      aria-label={`Workspace: ${meta.label}. Switch to ${meta.next}.`}
    >
      <StudioIcon view={view} />
    </button>
  );
};

const STORAGE_VIEW = 'catint_workspace_view';
const STORAGE_HINT = 'catint_studio_hint_seen';
const STORAGE_INIT = 'catint_workspace_initialized';

export const loadWorkspaceView = () => {
  const saved = localStorage.getItem(STORAGE_VIEW);
  if (OFF_CALL_VIEWS.includes(saved)) return saved;
  if (saved === 'transcript') return 'scoreboard';
  if (!localStorage.getItem(STORAGE_INIT)) {
    localStorage.setItem(STORAGE_INIT, '1');
    localStorage.setItem(STORAGE_VIEW, 'scoreboard');
    return 'scoreboard';
  }
  return 'scoreboard';
};

export const saveWorkspaceView = (view) => {
  if (OFF_CALL_VIEWS.includes(view)) {
    localStorage.setItem(STORAGE_VIEW, view);
  }
};

export const hasSeenStudioHint = () => localStorage.getItem(STORAGE_HINT) === '1';

export const markStudioHintSeen = () => {
  localStorage.setItem(STORAGE_HINT, '1');
};
