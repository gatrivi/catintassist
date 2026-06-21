import React from 'react';
import { StudioIcon } from './HeaderIcons';

export const OFF_CALL_VIEWS = ['scoreboard', 'soundboard'];

const VIEW_META = {
  scoreboard: { label: 'Scoreboard', next: 'Soundboard Studio' },
  soundboard: { label: 'Soundboard Studio', next: 'Scoreboard' },
};

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
      data-guide="workspace-switch"
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
