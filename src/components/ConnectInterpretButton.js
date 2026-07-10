import React, { useEffect, useMemo, useRef } from 'react';
import { BookmarkIcon, HeadsetIcon, MicIcon, RobotIcon } from './HeaderIcons';
import { ElementHintTarget } from './ElementHint';
import { resolveIdleAudioMode } from '../utils/offCallIdleMessages';

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
  size = 'top', // 'top' | 'idle'
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
}) => {
  const timeoutRef = useRef(null);
  const lastClickAtRef = useRef(0);
  const [isPendingDoubleTap, setIsPendingDoubleTap] = React.useState(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const style = useMemo(() => ({ color: '#fff' }), []);

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
    timeoutRef.current = setTimeout(() => {
      lastClickAtRef.current = 0;
      timeoutRef.current = null;
      setIsPendingDoubleTap(false);
      // If the parent says double-tap is required, first tap only arms UI.
      if (!requireDoubleTapIndicator) onSingle?.();
    }, DOUBLE_TAP_MS);

    if (requireDoubleTapIndicator) {
      setIsPendingDoubleTap(true);
      onArmDoubleTap?.();
    }
  };

  const hintBody = doubleTitle
    ? (requireDoubleTapIndicator
        ? `${label} — double-tap required (2nd click opens picker).`
        : `${singleTitle || label} (double tap: ${doubleTitle})`)
    : (singleTitle || label);

  const mode = audioMode || resolveIdleAudioMode({ micTestMode, audioSourceMode });
  const ModeIcon = modeIconFor(mode);
  const iconSize = size === 'idle' ? 16 : 14;

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
      className={`connect-interpret-btn btn-primaryish header-accent-connect ${size === 'idle' ? 'connect-interpret-btn--idle' : ''} ${flash || isPendingDoubleTap ? 'connect-interpret-flash' : ''}`}
      style={style}
      title={doubleTitle
        ? (requireDoubleTapIndicator
            ? `${label} — double-tap required (2nd click opens picker).`
            : `${singleTitle || label} (double tap: ${doubleTitle})`)
        : (singleTitle || label)}
      aria-label={singleTitle || label}
    >
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.28rem' }}
        aria-hidden
      >
        <ModeIcon size={iconSize} />
        {providerReady ? <RobotIcon size={iconSize} /> : null}
      </span>
    </button>
    </ElementHintTarget>
  );
};
