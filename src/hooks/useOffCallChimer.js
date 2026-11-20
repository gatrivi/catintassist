import { useEffect, useRef, useState, useCallback } from 'react';
import {
  readOffCallChimeSettings,
  saveOffCallChimeSettings,
  resolveOffCallChimeTone,
  playOffCallChime,
  synthesizeMetricTune,
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
  isOnAvail = false,
  isHold = false,
  holdSeconds = 0,
  lastActivityTime = 0,
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
    playOffCallChime(tuneId, {
      force: true,
      volume: settings.volume,
      metrics: {
        dailyMinutes: Number(stats?.dailyMinutes) || 0,
        dayOfWeek: new Date().getDay(),
        dayOfMonth: new Date().getDate(),
      },
    });
  }, [settings.volume, stats?.dailyMinutes]);

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

      const baseTune = resolveOffCallChimeTone({
        isActive,
        isBreakActive,
        isOnAvail,
        isHold,
        holdSeconds,
        silenceSecs: 0,
        breakLeft,
        idleSecs: 0,
        deficitMins,
      });

      if (!baseTune) return null;
      return synthesizeMetricTune(baseTune, {
        dailyMinutes,
        deficitMins,
        dayOfWeek: new Date().getDay(),
        dayOfMonth: new Date().getDate(),
      });
    } catch {
      return CHIME_TUNES.on_pace;
    }
  }, [isActive, isBreakActive, isOnAvail, isHold, holdSeconds, stats, goalWorkDays]);

  // Off-call and in-call silence minute timers (wall-clock based)
  const offCallStartRef = useRef(0);
  const lastChimeMinuteRef = useRef(0);
  const lastSilenceMinuteRef = useRef(0);
  const lastHoldOvertimeMinuteRef = useRef(0);
  const activePlaybackRef = useRef(null);

  useEffect(() => {
    // Mode transitions
    if (!isActive) {
      // Switched to off-call: cancel in-call silence trackers
      lastSilenceMinuteRef.current = 0;
      lastHoldOvertimeMinuteRef.current = 0;
      if (!offCallStartRef.current) {
        offCallStartRef.current = Date.now();
        lastChimeMinuteRef.current = 0;
      }
    } else {
      // Switched to active call: reset off-call counters
      offCallStartRef.current = 0;
      lastChimeMinuteRef.current = 0;
    }

    const timer = setInterval(() => {
      if (!settings.enabled) return;
      const now = Date.now();

      // CASE 1: OFF-CALL
      if (!isActive) {
        // v4.217.0: If user is ON AVAIL waiting for calls, idle chimes are silenced!
        if (isOnAvail) {
          lastChimeMinuteRef.current = 0;
          return;
        }

        const elapsedMs = now - (offCallStartRef.current || now);
        const elapsedMins = Math.floor(elapsedMs / 60000);
        const elapsedSecs = Math.floor(elapsedMs / 1000);

        if (elapsedMins > lastChimeMinuteRef.current) {
          lastChimeMinuteRef.current = elapsedMins;

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

          const chimeMetrics = {
            dailyMinutes,
            deficitMins,
            dayOfWeek: new Date().getDay(),
            dayOfMonth: new Date().getDate(),
          };

          const tune = resolveOffCallChimeTone({
            isActive: false,
            isBreakActive,
            isOnAvail,
            breakLeft,
            idleSecs: elapsedSecs,
            deficitMins,
          });

          if (tune) {
            activePlaybackRef.current = playOffCallChime(tune, {
              volume: settings.volume,
              metrics: chimeMetrics,
            });
          }
        }
        return;
      }

      // CASE 2: ACTIVE CALL
      // Subcase 2a: ON HOLD
      if (isHold) {
        lastSilenceMinuteRef.current = 0; // Hold overrides silence timer
        // Hold is muted for first 15 minutes (900s). Overtime warns after 15m.
        if (holdSeconds > 900) {
          const overtimeMins = Math.floor((holdSeconds - 900) / 60);
          if (overtimeMins > lastHoldOvertimeMinuteRef.current) {
            lastHoldOvertimeMinuteRef.current = overtimeMins;
            const tune = resolveOffCallChimeTone({
              isActive: true,
              isHold: true,
              holdSeconds,
            });
            if (tune) {
              activePlaybackRef.current = playOffCallChime(tune, {
                volume: settings.volume,
                metrics: {
                  dailyMinutes: Number(stats?.dailyMinutes) || 0,
                  dayOfWeek: new Date().getDay(),
                  dayOfMonth: new Date().getDate(),
                },
              });
            }
          }
        } else {
          lastHoldOvertimeMinuteRef.current = 0;
        }
        return;
      }

      // Subcase 2b: ACTIVE CALL, NOT ON HOLD — Silence detection (no speech / transcription)
      lastHoldOvertimeMinuteRef.current = 0;
      const silenceSecs = Math.max(0, Math.floor((now - (lastActivityTime || now)) / 1000));
      const silenceMins = Math.floor(silenceSecs / 60);

      // If speech occurred within last 60s, reset silence minute count
      if (silenceMins < 1) {
        lastSilenceMinuteRef.current = 0;
        return;
      }

      // Silence >= 1m: Chime once for each full minute of silence (1m, 2m, 3m...)
      if (silenceMins > lastSilenceMinuteRef.current) {
        lastSilenceMinuteRef.current = silenceMins;
        const tune = resolveOffCallChimeTone({
          isActive: true,
          isHold: false,
          silenceSecs,
        });
        if (tune) {
          activePlaybackRef.current = playOffCallChime(tune, {
            volume: settings.volume,
            metrics: {
              dailyMinutes: Number(stats?.dailyMinutes) || 0,
              dayOfWeek: new Date().getDay(),
              dayOfMonth: new Date().getDate(),
            },
          });
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    isActive,
    isBreakActive,
    isOnAvail,
    isHold,
    holdSeconds,
    lastActivityTime,
    settings.enabled,
    settings.volume,
    stats,
    goalWorkDays,
  ]);

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
