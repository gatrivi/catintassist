import React from 'react';

/** Stroke icons for header controls — matches ConnectInterpretButton / art-deco palette via currentColor. */
const Svg = ({ size = 18, strokeWidth = 2, children, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className="header-icon"
    {...rest}
  >
    {children}
  </svg>
);

export const PlayIcon = (props) => (
  <Svg {...props}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </Svg>
);

export const StopIcon = (props) => (
  <Svg {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </Svg>
);

export const KeyIcon = (props) => (
  <Svg {...props}>
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </Svg>
);

export const MicIcon = (props) => (
  <Svg {...props}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </Svg>
);

/** Tab-share STT (🔖) */
export const BookmarkIcon = (props) => (
  <Svg {...props}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);

/** VB-Cable STT (🎧) */
export const HeadsetIcon = (props) => (
  <Svg {...props}>
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </Svg>
);

/** Interpreting / STT provider ready */
export const RobotIcon = (props) => (
  <Svg {...props}>
    <rect x="5" y="9" width="14" height="10" rx="2" />
    <path d="M12 3v4" />
    <circle cx="12" cy="2.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="13" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="15" cy="13" r="1.25" fill="currentColor" stroke="none" />
    <path d="M9 17h6" />
  </Svg>
);

export const TargetIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </Svg>
);

export const PauseIcon = (props) => (
  <Svg {...props}>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </Svg>
);

export const ZapIcon = (props) => (
  <Svg {...props}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </Svg>
);

export const CoffeeIcon = (props) => (
  <Svg {...props}>
    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="1" x2="6" y2="4" />
    <line x1="10" y1="1" x2="10" y2="4" />
    <line x1="14" y1="1" x2="14" y2="4" />
  </Svg>
);

export const MoonIcon = (props) => (
  <Svg {...props}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Svg>
);

export const NotesIcon = (props) => (
  <Svg {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </Svg>
);

export const ToolsIcon = (props) => (
  <Svg {...props}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </Svg>
);

export const HelpIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Svg>
);

export const EditIcon = (props) => (
  <Svg {...props}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);

export const ChevronUpIcon = (props) => (
  <Svg {...props}>
    <polyline points="18 15 12 9 6 15" />
  </Svg>
);

export const ChevronDownIcon = (props) => (
  <Svg {...props}>
    <polyline points="6 9 12 15 18 9" />
  </Svg>
);

export const SignalIcon = (props) => (
  <Svg {...props}>
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </Svg>
);

export const SignalOffIcon = (props) => (
  <Svg {...props}>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
    <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </Svg>
);

export const FocusIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
  </Svg>
);

export const FocusOffIcon = (props) => (
  <Svg {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </Svg>
);

export const SettingsIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

export const GameIcon = (props) => (
  <Svg {...props}>
    <line x1="6" y1="12" x2="10" y2="12" />
    <line x1="8" y1="10" x2="8" y2="14" />
    <line x1="15" y1="13" x2="15.01" y2="13" />
    <line x1="18" y1="11" x2="18.01" y2="11" />
    <rect x="2" y="6" width="20" height="12" rx="2" />
  </Svg>
);

export const GridIcon = (props) => (
  <Svg {...props}>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </Svg>
);

export const CalendarIcon = (props) => (
  <Svg {...props} strokeWidth={1.75}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </Svg>
);

export const SunIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </Svg>
);

export const LadderIcon = (props) => (
  <Svg {...props}>
    <path d="M8 3v18" />
    <path d="M16 3v18" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </Svg>
);

/** Art-deco studio pyramid — shared with workspace switcher. */
export const StudioIcon = ({ view = 'scoreboard', size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="header-icon">
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
