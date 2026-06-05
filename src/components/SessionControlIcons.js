import React from 'react';

/** Art-deco session icons — stepped frames, match WorkspaceViewSwitcher stroke style */

export const ConnectIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
    <path d="M9 7 L17 12 L9 17 Z" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="miter" />
    <path d="M3 8 H6 M18 8 H21 M3 16 H6 M18 16 H21" stroke="currentColor" strokeWidth="0.7" opacity="0.45" />
  </svg>
);

export const ReattachIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
    <path d="M7 12 H11 M13 12 H17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
    <path d="M11 9 L11 15 M13 9 L13 15" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
  </svg>
);

export const StopIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
    <rect x="8" y="8" width="8" height="8" fill="currentColor" stroke="currentColor" strokeWidth="0.5" />
    <path d="M3 8 H6 M18 8 H21" stroke="currentColor" strokeWidth="0.7" opacity="0.45" />
  </svg>
);

export const HoldIcon = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
    <rect x="8" y="7" width="3" height="10" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.1" />
    <rect x="13" y="7" width="3" height="10" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.1" />
  </svg>
);

export const ZapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
    <path d="M13 5 L8 13 H12 L10 19 L17 10 H13 Z" fill="currentColor" stroke="currentColor" strokeWidth="0.4" strokeLinejoin="miter" />
  </svg>
);

export const BreakIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
    <path d="M7 9 H17 M8 9 V15 H16 V9" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="miter" />
    <path d="M9 15 H15 M10 15 V17 H14 V15" stroke="currentColor" strokeWidth="1" />
    <path d="M8 7 H10 M14 7 H16" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
  </svg>
);

export const EndDayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
    <path d="M14 7 A6 6 0 1 0 14 19" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square" />
    <path d="M14 7 V5 M14 19 V17" stroke="currentColor" strokeWidth="1" opacity="0.55" />
  </svg>
);
