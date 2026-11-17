import { useEffect, useRef, useState, useCallback } from 'react';
import {
  readOffCallChimeSettings,
  saveOffCallChimeSettings,
  resolveOffCallChimeTone,
  playOffCallChime,
  CHIME_TUNES,
} from '../utils/offCallChime';
import { computeCatchUp } from '../utils/catchUpPlan';

/**
 * useOffCallChimer (v4.213.0).
 *
 * Runs an accurate off-call minute loop that fires an adaptive musical chime
 * every 60 seconds while off call (!isActive).
 * Silent during active calls. Adapts tune to pace and break budget.
 */
export const useOffCallChimer = ({
  isActive = false,
  isBreakActive = false,
  stats = {},
  goalWorkDays = 0,
} = {}) => {
  const [settings, setSettings] = useState(readOffCallChimeSettings);

  // Sync settings when changed from SettingsPanel or other tabs
  useEffect(() => {
    const handleUpdate = (e) => {
      if (e?.detail) setSettings(e.detail);
      else setSettings(readOffCallChimeSettings());
    };
    window.addEventListener('catint_chime_settings_changed', handleUpdate);
    return () => window.removeEventListener('catint_chime_settings_changed', handleUpdate);
  }, []);

  const toggleChime = useCallback((forcedValue) => {
    const nextVal = typeof forcedValue === 'boolean' ? forcedValue : !settings.enabled;
    const next = { ...settings, enabled: nextVal };
    saveOffCallChimeSettings(next);
    setSettings(next);
  }, [settings]);

  const updateVolume = useCallback((vol) => {
    const next = { ...settings, volume: Math.max(0.05, Math.min(1, Number(vol) || 0.6)) };
    saveOffCallChimeSettings(next);
    setSettings(next);
  }, [settings]);

  const previewTune = useCallback((tuneId) => {
    playOffCallChime(tuneId, { force: true, volume: settings.volume });
  }, [settings.volume]);

  // Current tune preview based on current state
  const getCurrentTune = useCallback(() => {
    try {
      const goalMinutes = Number(stats?.goalMinutes) || 0;
      const monthlyMinutes = Number(stats?.monthlyMinutes) || 0;
      const dailyMinutes = Number(stats?.dailyMinutes) || 0;
      const breakLimit = 90;
      const breakUsed = Number(stats?.dailyBreakMinutes) || 0;
      const breakLeft = Math.max(0, breakLimit - breakUsed);

      let deficitMins = 0;
      if (goalMinutes > 0) {
        const plan = computeCatchUp({
          goalMinutes,
          monthlyMinutes,
          dailyMinutes,
          workDays: goalWorkDays,
          goalSetAt: stats?.goalSetAt || null,
          goalBaseMinutes: stats?.goalBaseMinutes || 0,
        });
        deficitMins = plan?.deficitMins || 0;
      }

      return resolveOffCallChimeTone({
        isBreakActive,
        breakLeft,
        idleSecs: 0,
        deficitMins,
      });
    } catch {
      return CHIME_TUNES.on_pace;
    }
  }, [isBreakActive, stats, goalWorkDays]);

  // Off-call minute timer
  const offCallSecsRef = useRef(0);
  const activePlaybackRef = useRef(null);

  useEffect(() => {
    // If currently on call, cancel any playing chime and reset counter
    if (isActive) {
      offCallSecsRef.current = 0;
      if (activePlaybackRef.current) {
        activePlaybackRef.current.stop();
        activePlaybackRef.current = null;
      }
      return undefined;
    }

    // Interval counts seconds off-call
    const timer = setInterval(() => {
      offCallSecsRef.current += 1;
      const secs = offCallSecsRef.current;

      // Fire chime exactly at each 60-second mark (1m, 2m, 3m...)
      if (secs > 0 && secs % 60 === 0) {
        if (!settings.enabled) return;

        const goalMinutes = Number(stats?.goalMinutes) || 0;
        const monthlyMinutes = Number(stats?.monthlyMinutes) || 0;
        const dailyMinutes = Number(stats?.dailyMinutes) || 0;
        const breakLimit = 90;
        const breakUsed = Number(stats?.dailyBreakMinutes) || 0;
        const breakLeft = Math.max(0, breakLimit - breakUsed);

        let deficitMins = 0;
        if (goalMinutes > 0) {
          const plan = computeCatchUp({
            goalMinutes,
            monthlyMinutes,
            dailyMinutes,
            workDays: goalWorkDays,
            goalSetAt: stats?.goalSetAt || null,
            goalBaseMinutes: stats?.goalBaseMinutes || 0,
          });
          deficitMins = plan?.deficitMins || 0;
        }

        const tune = resolveOffCallChimeTone({
          isBreakActive,
          breakLeft,
          idleSecs: secs,
          deficitMins,
        });

        activePlaybackRef.current = playOffCallChime(tune, { volume: settings.volume });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, isBreakActive, settings.enabled, settings.volume, stats, goalWorkDays]);

  return {
    isChimeEnabled: settings.enabled,
    toggleChime,
    chimeVolume: settings.volume,
    setChimeVolume: updateVolume,
    previewTune,
    getCurrentTune,
    CHIME_TUNES,
  };
};
