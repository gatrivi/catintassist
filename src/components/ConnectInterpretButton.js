import React, { useEffect, useRef } from 'react';
import { BookmarkIcon, HeadsetIcon, MicIcon, RobotIcon } from './HeaderIcons';
import { ElementHintTarget } from './ElementHint';
import { resolveIdleAudioMode } from '../utils/offCallIdleMessages';
import { formatTime } from './HeaderWidgets';

const DOUBLE_TAP_MS = 280;

const modeIconFor = (mode) => {
  if (mode === 'mic') return MicIcon;
  if (mode === 'virtualCable') return HeadsetIcon;
  return BookmarkIcon;
};

export const ConnectInterpretButton = ({
  onSingle,
  onDouble,
  flash = false,
  disabled = false,
  size = 'top', // 'top' | 'idle' | 'detailed-bar'
  singleTitle,
  doubleTitle,
  label = 'Connect',
  requireDoubleTapIndicator = false,
  onArmDoubleTap,
  pendingDoubleTapTitle = 'Tap again to start',
  /** 'tab' | 'virtualCable' | 'mic' — drives leading icon */
  audioMode,
  micTestMode = false,
  audioSourceMode = 'tab',
  /** Deepgram / STT provider unlocked & available → show robot */
  providerReady = false,
  /** Workday progress details for 'detailed-bar' mode */
  totalOnCallSeconds = 0,
  totalOffCallSeconds = 0,
  compactShiftRemainingSeconds = 0,
  compactWorkdaySegments = [],
  shiftElapsedRatio = 0,
  dailyGoal = 0,
  totalDailyMins = 0,
}) => {
  const timeoutRef = useRef(null);
  const lastClickAtRef = useRef(0);
  const [isPendingDoubleTap, setIsPendingDoubleTap] = React.useState(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = () => {
    if (disabled) return;
    const now = Date.now();
    const last = lastClickAtRef.current;
    const isDouble = last && (now - last) <= DOUBLE_TAP_MS;

    if (isDouble) {
      lastClickAtRef.current = 0;
      setIsPendingDoubleTap(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      onDouble?.();
      return;
    }

    lastClickAtRef.current = now;

    // First tap only arms UI when double-tap is required.
    if (requireDoubleTapIndicator) {
      setIsPendingDoubleTap(true);
      onArmDoubleTap?.();
      return;
    }

    // Fire immediately — mobile Safari/Chrome drop user activation after setTimeout,
    // so delayed getUserMedia/getDisplayMedia never shows a permission prompt.
    onSingle?.();
  };

  const hintBody = doubleTitle
    ? (requireDoubleTapIndicator
        ? `${label} — double-tap required (2nd click opens picker).`
        : `${singleTitle || label} (double tap: ${doubleTitle})`)
    : (singleTitle || label);

  const mode = audioMode || resolveIdleAudioMode({ micTestMode, audioSourceMode });
  const ModeIcon = modeIconFor(mode);
  const iconSize = size === 'idle' ? 16 : 14;

  const isDetailed = size === 'detailed-bar';

  const detailedTitle = [
    doubleTitle
      ? (requireDoubleTapIndicator
          ? `${label} — double-tap required (2nd click opens picker).`
          : `${singleTitle || label} (double tap: ${doubleTitle})`)
      : (singleTitle || label),
    `Workday: ${formatTime(totalOnCallSeconds)} on call; ${formatTime(totalOffCallSeconds)} off call; ${formatTime(compactShiftRemainingSeconds)} left.`,
    dailyGoal > 0 ? `Target: ${Math.round(totalDailyMins)}m/${Math.round(dailyGoal)}m.` : null,
    'Blue = calls; orange = available; red = break.',
  ].filter(Boolean).join(' — ');

  return (
    <ElementHintTarget
      elementId="header-connect-btn"
      guideKey="connect"
      heading={label || 'Connect'}
      body={hintBody}
      color="#10b981"
    >
    <button
      type="button"
      id="header-connect-btn"
      data-guide="connect"
      data-audio-mode={mode}
      data-provider-ready={providerReady ? '1' : '0'}
      onClick={handleClick}
      disabled={disabled}
      className={`connect-interpret-btn header-chrome-btn header-accent-connect ${size === 'idle' ? 'connect-interpret-btn--idle' : ''} ${isDetailed ? 'connect-interpret-btn--detailed' : ''} ${flash || isPendingDoubleTap ? 'connect-interpret-flash' : ''}`}
      title={isDetailed ? detailedTitle : (doubleTitle
        ? (requireDoubleTapIndicator
            ? `${label} — double-tap required (2nd click opens picker).`
            : `${singleTitle || label} (double tap: ${doubleTitle})`)
        : (singleTitle || label))}
      aria-label={singleTitle || label}
    >
      {isDetailed ? (
        <>
          <div className="connect-interpret-btn__top-row" aria-hidden="true">
            <div className="connect-interpret-btn__action-pill">
              <span className="connect-interpret-btn__icons">
                <ModeIcon size={13} />
                {providerReady ? <RobotIcon size={12} /> : null}
              </span>
              <span className="connect-interpret-btn__action-label">
                {isPendingDoubleTap ? (pendingDoubleTapTitle || 'TAP AGAIN') : (label || 'CONNECT TAB').toUpperCase()}
              </span>
            </div>

            <div className="connect-interpret-btn__readouts">
              <span className="connect-interpret-btn__stat stat--on" title={`On call today: ${formatTime(totalOnCallSeconds)}`}>
                <b>ON</b> {formatTime(totalOnCallSeconds)}
              </span>
              <span className="connect-interpret-btn__stat stat--off" title={`Off call today (avail + break): ${formatTime(totalOffCallSeconds)}`}>
                <b>OFF</b> {formatTime(totalOffCallSeconds)}
              </span>
              <span className="connect-interpret-btn__stat stat--left" title={`Shift time left until 18:00: ${formatTime(compactShiftRemainingSeconds)}`}>
                <b>LEFT</b> {formatTime(compactShiftRemainingSeconds)}
              </span>
              {dailyGoal > 0 && (
                <span className="connect-interpret-btn__stat stat--goal" title={`Daily progress: ${Math.round(totalDailyMins)}m banked of ${Math.round(dailyGoal)}m target`}>
                  <b>GOAL</b> {Math.round(totalDailyMins)}/{Math.round(dailyGoal)}m ({Math.min(999, Math.round((totalDailyMins / dailyGoal) * 100))}%)
                </span>
              )}
            </div>

            <div className="connect-interpret-btn__shift-range">
              <span>☀️ 09:00</span>
              <span className="range-sep">→</span>
              <span>🌙 18:00</span>
            </div>
          </div>

          <div className="connect-interpret-btn__track" aria-hidden="true">
            <div className="connect-interpret-btn__track-ticks">
              {[0, 22.2, 44.4, 66.6, 88.8, 100].map((pos, i) => (
                <span
                  key={i}
                  className="connect-interpret-btn__track-tick"
                  style={{ left: `${pos}%` }}
                  title={['09:00', '11:00', '13:00', '15:00', '17:00', '18:00'][i]}
                />
              ))}
            </div>

            {dailyGoal > 0 && (
              <span
                className="connect-interpret-btn__goal-notch"
                style={{ left: `${Math.min(100, (dailyGoal / 480) * 100)}%` }}
                title={`Target: ${Math.round(dailyGoal)}m`}
              />
            )}

            {compactWorkdaySegments.map((segment) => {
              const startStr = segment.start ? new Date(segment.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              const endStr = segment.end ? new Date(segment.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'NOW';
              const durationMins = segment.start && segment.end ? Math.max(1, Math.round((segment.end - segment.start) / 60000)) : '';
              const segTitle = `${segment.type.toUpperCase()}: ${startStr} → ${endStr}${durationMins ? ` (${durationMins}m)` : ''}`;
              return (
                <span
                  key={`${segment.type}-${segment.index}`}
                  className={`compact-call-goal-meter__segment compact-call-goal-meter__segment--${segment.type}`}
                  style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                  title={segTitle}
                />
              );
            })}

            <span
              className="compact-call-goal-meter__now"
              style={{ left: `${shiftElapsedRatio * 100}%` }}
              title={`Current time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            />
          </div>
        </>
      ) : (
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.28rem' }}
          aria-hidden
        >
          <ModeIcon size={iconSize} />
          {providerReady ? <RobotIcon size={iconSize} /> : null}
        </span>
      )}
    </button>
    </ElementHintTarget>
  );
};
