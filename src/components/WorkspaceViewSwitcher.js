import React from 'react';

export const WORKSPACE_VIEWS = ['transcript', 'soundboard'];

const VIEW_META = {
  transcript: { label: 'Transcript', next: 'Soundboard Lab' },
  soundboard: { label: 'Soundboard Lab', next: 'Transcript' },
};

/** Art-deco stepped fan — current view lights the center tier. */
const ViewIcon = ({ view }) => (
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
      opacity={view === 'transcript' ? 1 : 0.35}
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

export const WorkspaceViewSwitcher = ({ view, onCycle, disabled = false }) => {
  const meta = VIEW_META[view] || VIEW_META.transcript;

  return (
    <button
      type="button"
      className={`workspace-view-btn${disabled ? ' is-disabled' : ''}`}
      onClick={onCycle}
      disabled={disabled}
      title={
        disabled
          ? 'Soundboard Lab — available off-call only'
          : `${meta.label} · click → ${meta.next}`
      }
      aria-label={`Workspace view: ${meta.label}. Click for ${meta.next}.`}
    >
      <ViewIcon view={view} />
    </button>
  );
};

export const loadWorkspaceView = () => {
  const saved = localStorage.getItem('catint_workspace_view');
  return WORKSPACE_VIEWS.includes(saved) ? saved : 'transcript';
};

export const saveWorkspaceView = (view) => {
  localStorage.setItem('catint_workspace_view', view);
};
