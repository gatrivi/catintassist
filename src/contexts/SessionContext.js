import { catWarn, catError } from "../utils/catLog";
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useRewardAudio } from '../hooks/useRewardAudio';
import { set as idbSet, get as idbGet } from 'idb-keyval';
import {
  loadPreset,
  loadVisibleMetrics,
  savePreset,
  saveVisibleMetrics,
  getPresetConfig,
} from '../utils/scoreboardLayout';
import { mergeImportedDays } from '../utils/callLogImport';
import { isDateInCurrentMonth, applyDayEditToStats } from '../utils/pastDayEdit';
import { rollDaySnapshot } from '../utils/dayRoll';
import { billableSecondsForCall } from '../utils/callBilling';
import { TIMETRACK_CHANGED_EVENT } from '../utils/timeTrackSync';
import { shouldAutoHold, shouldAutoResume } from '../utils/holdState';
import {
  shouldAutoBreak,
  shouldResetWorkTimer,
  MANUAL_BREAK_SUPPRESS_MS,
} from '../utils/breakState';
import {
  canAutopilotStart,
  canAutopilotEnd,
  AUTOPILOT_START_COOLDOWN_MS,
  AUTOPILOT_END_COUNTDOWN_MS,
  AUTOPILOT_FAREWELL_SILENCE_MS,
} from '../utils/callAutopilot';
import {
  saveLastCallArchive,
  loadLastCallArchive,
  clearLastCallArchive as clearLastCallArchiveStore,
  isSealableArchive,
  buildLastCallArchive,
} from '../utils/lastCallArchive';
import {
  buildGoalAnchor,
  rollGoalForNewMonth,
  isGoalWorkDays,
} from '../utils/goalAnchor';

const PURGE_KEYS_PREFIX = 'trans_cache:';
const GOAL_WORKDAYS_KEY = 'catint_goal_workdays_v1';

/** Workdays basis (17/22/26/28/30 d/mo) — read straight from storage so the
 *  stats initializer can use it before the goalWorkDays state exists. */
const readStoredGoalWorkDays = () => {
  try {
    const v = Number(localStorage.getItem(GOAL_WORKDAYS_KEY));
    return isGoalWorkDays(v) ? v : 28;
  } catch { return 28; }
};

const safeLocalStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      catWarn('[Storage] Quota exceeded, purging non-essential data...');
      // Emergency: clear all translation caches to make room for critical stats
      Object.keys(localStorage)
        .filter(k => k.startsWith(PURGE_KEYS_PREFIX))
        .forEach(k => localStorage.removeItem(k));
      
      // Try one last time
      try {
        localStorage.setItem(key, value);
      } catch (err) {
        catError('[Storage] CRITICAL: Could not save after purge!', err);
      }
    }
  }
};

export const safeSet = safeLocalStorageSet;

const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
  const { playPurseOpen, playCoinStack, initAudio: initRewardAudio } = useRewardAudio();
  const [isActive, setIsActive] = useState(false); 
  const [isZombieCall, setIsZombieCall] = useState(() => {
    const wasActive = localStorage.getItem('catint_active');
    return wasActive === 'true'; 
  });

  // HIPAA: after STOP/disconnect we keep transcript/translation/pins for a short grace
  // window (to allow quick reconnect for "bad translation service" refresh).
  const HIPAA_GRACE_MS_DEFAULT = 15000;
  const [hipaaGraceActive, setHipaaGraceActive] = useState(false);
  const hipaaGraceActiveRef = useRef(false);
  const hipaaGraceTimerRef = useRef(null);
  const skipPinnedClearOnceRef = useRef(false);
  
  const [captions, setCaptions] = useState([]);
  const captionsRef = useRef(captions);
  useEffect(() => { captionsRef.current = captions; }, [captions]);
  const [isCaptionsLoaded, setIsCaptionsLoaded] = useState(false);

  const clearZombieState = () => {
    setIsZombieCall(false);
    safeLocalStorageSet('catint_active', 'false');
  };

  const [translationMood, setTranslationMood] = useState(() => localStorage.getItem('catint_trans_mood') || 'auto');
  
  useEffect(() => {
    localStorage.setItem('catint_trans_mood', translationMood);
  }, [translationMood]);

  const [speechAutoConnect, setSpeechAutoConnect] = useState(() => {
    try {
      // v4.86.7: default ON — user requested auto start on speech. Toggle in Settings.
      const stored = localStorage.getItem('catint_speech_auto_v1');
      return stored === null ? true : stored === '1';
    } catch {
      return true;
    }
  });
  const speechAutoConnectRef = useRef(speechAutoConnect);
  useEffect(() => {
    speechAutoConnectRef.current = speechAutoConnect;
    try {
      localStorage.setItem('catint_speech_auto_v1', speechAutoConnect ? '1' : '0');
    } catch (_) {}
  }, [speechAutoConnect]);

  // ── CALL AUTOPILOT (v4.98.0): phrase-driven auto start/end ──
  // When ON, speech alone no longer starts a call — only the platform's own
  // ring/bridge phrase starts it and a disconnect phrase ends it (10s
  // cancellable banner). Refs mirror state: socket closures read them live.
  const [callAutopilot, setCallAutopilot] = useState(() => {
    try {
      // Default OFF for the first release — opt in from Settings → Behavior.
      return localStorage.getItem('catint_autopilot_v1') === '1';
    } catch {
      return false;
    }
  });
  const callAutopilotRef = useRef(callAutopilot);
  useEffect(() => {
    callAutopilotRef.current = callAutopilot;
    try {
      localStorage.setItem('catint_autopilot_v1', callAutopilot ? '1' : '0');
    } catch (_) {}
  }, [callAutopilot]);

  const [vaultStatus, setVaultStatus] = useState('idle');
  useEffect(() => {
    const onUnlocking = () => setVaultStatus('unlocking');
    const onIdle = () => setVaultStatus('idle');
    window.addEventListener('cat_vault_unlocking', onUnlocking);
    window.addEventListener('cat_deepgram_runtime_key_changed', onIdle);
    return () => {
      window.removeEventListener('cat_vault_unlocking', onUnlocking);
      window.removeEventListener('cat_deepgram_runtime_key_changed', onIdle);
    };
  }, []);

  const callHadSpeechRef = useRef(false);
  const callLastSpeechAtRef = useRef(Date.now());

  // ── v4.99.2: LIVE COUNTERS ARE SINGLE-DAY ─────────────────────────────────
  // catint_s_sec / catint_a_sec / catint_b_sec used to restore stale values
  // from the previous day, so yesterday's off-call tail banked into TODAY
  // (the impossible "893m OFF CALL"). A day tag wipes them on the first load
  // of a new day; startSession re-checks for the open-across-midnight case.
  const LIVE_COUNTER_KEYS = ['catint_s_sec', 'catint_a_sec', 'catint_b_sec', 'catint_last_call_secs', 'catint_last_call_ended_at'];
  const COUNTERS_DAY_KEY = 'catint_counters_day';
  const wipeStaleLiveCounters = () => {
    try {
      const today = new Date().toDateString();
      if (localStorage.getItem(COUNTERS_DAY_KEY) === today) return today;
      LIVE_COUNTER_KEYS.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(COUNTERS_DAY_KEY, today);
      return today;
    } catch (_) {
      return new Date().toDateString();
    }
  };
  const liveCountersDayRef = useRef(null);
  if (liveCountersDayRef.current === null) {
    liveCountersDayRef.current = wipeStaleLiveCounters();
  }
  // ──────────────────────────────────────────────────────────────────────────

  const [lastSilenceDeductionMins, setLastSilenceDeductionMins] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(() => Number(localStorage.getItem('catint_s_sec')) || 0);
  const [isBreakActive, setIsBreakActive] = useState(() => JSON.parse(localStorage.getItem('catint_break')) || false);
  const [breakSeconds, setBreakSeconds] = useState(() => Number(localStorage.getItem('catint_b_sec')) || 0);
  const [availSeconds, setAvailSeconds] = useState(() => Number(localStorage.getItem('catint_a_sec')) || 0);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  // Tracks the last time we saw English speech come through STT.
  // Used to time "non-doctor hold" during silence (doctors speak English).
  const [lastEnglishActivityTime, setLastEnglishActivityTime] = useState(Date.now());
  const [historyTimeline, setHistoryTimeline] = useState(() => {
    try { return JSON.parse(localStorage.getItem('catintassist_history_timeline')) || {}; } catch(e) { return {}; }
  });
  const [isHold, setIsHold] = useState(() => JSON.parse(localStorage.getItem('catint_hold')) || false);
  const [holdSeconds, setHoldSeconds] = useState(() => Number(localStorage.getItem('catint_hold_sec')) || 0);
  const [dailyTimeline, setDailyTimeline] = useState(() => {
    try { return JSON.parse(localStorage.getItem('catintassist_timeline')) || []; } catch(e) { return []; }
  });
  
  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem('catintassist_stats');
    const now = new Date();
    const today = now.toDateString();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    let initialStats = {
      dailyMinutes: 0,
      dailyBreakMinutes: 0,
      dailyAvailMinutes: 0,
      weeklyMinutes: 0,
      monthlyMinutes: 0,
      goalMinutes: 9231, // v4.100.1: $1200 @ $0.13/min (was 5500 FLOOR)
      // ANCHORED-GOAL: a banked goal counts from the moment it was banked.
      // goalMinutes stays the MONTH TOTAL; these three record where its pace
      // clock starts so a goal set on the 20th is not judged against day 1.
      goalSetAt: null,          // 'YYYY-MM-DD' it was banked (null = legacy stats)
      goalBaseMinutes: 0,       // minutes already worked when it was banked
      goalPerWorkdayMinutes: 0, // commitment per workday (re-derives next month)
      callsToday: 0,
      streak: 0,
      lastDate: today,
      lastMonthKey: currentMonthKey,
      dayStartTime: null,
      shiftStartSentiment: 0 // minutes late from 9am
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.lastDate && parsed.lastDate !== today) {
          // Midnight rollover: write previous day's minutes into log
          const prevLog = JSON.parse(localStorage.getItem('catintassist_daily_log')) || {};
          const prevHistory = JSON.parse(localStorage.getItem('catintassist_history_timeline')) || {};
          
          if (parsed.dailyMinutes > 0) {
            prevLog[parsed.lastDate] = Math.round(parsed.dailyMinutes);
            safeLocalStorageSet('catintassist_daily_log', JSON.stringify(prevLog));
          }

          // Archive timeline
          const currentTimeline = JSON.parse(localStorage.getItem('catintassist_timeline')) || [];
          if (currentTimeline.length > 0) {
             prevHistory[parsed.lastDate] = currentTimeline;
             safeLocalStorageSet('catintassist_history_timeline', JSON.stringify(prevHistory));
             setHistoryTimeline(prevHistory);
          }

          parsed.dailyMinutes = 0;
          parsed.dailyBreakMinutes = 0;
          parsed.dailyAvailMinutes = 0;
          parsed.callsToday = 0;
          parsed.dayStartTime = null;
          parsed.lastBreakEndTime = null;
          parsed.lastDate = today;
          // Clear timeline on new day
          safeLocalStorageSet('catintassist_timeline', JSON.stringify([]));
          setDailyTimeline([]);
          setHoldSeconds(0);
        }

        // Month rollover: monthlyMinutes drives “income” and the ladder bar.
        const parsedMonthKey = parsed.lastMonthKey || (() => {
          const d = new Date(parsed.lastDate || today);
          return `${d.getFullYear()}-${d.getMonth()}`;
        })();

        if (parsedMonthKey !== currentMonthKey) {
          parsed.monthlyMinutes = 0;
          parsed.weeklyMinutes = 0;
          parsed.shiftStartSentiment = 0;
          // ANCHORED-GOAL: a fresh month gets the full-month quota again from
          // the same commitment — never the prorated mid-month target.
          Object.assign(parsed, rollGoalForNewMonth(parsed, readStoredGoalWorkDays(), now));
        }

        parsed.lastMonthKey = currentMonthKey;

        return { ...initialStats, ...parsed };
      } catch (e) { return initialStats; }
    }
    return initialStats;
  });

  // CAPTIONS PERSISTENCE: Save/Load from IndexedDB to survive refreshes
  useEffect(() => {
    const loadCaptions = async () => {
      try {
        const saved = await idbGet('catint_captions_v2');
        // Don't stomp live STT captions if audio connected before IDB finished loading.
        if (saved && Array.isArray(saved) && captionsRef.current.length === 0) {
          setCaptions(saved);
        }
      } catch (e) {
        catWarn('[Session:load] Failed to load captions:', e);
      } finally {
        setIsCaptionsLoaded(true);
      }
    };
    loadCaptions();
  }, []);

  // v4.130.1 last-call seal: STOP wipes live captions, but a read-only
  // copy survives until next call / End Day / explicit clear. Update
  // reloads and DG reconnects never seal — only real call ends do.
  const [lastCallArchive, setLastCallArchive] = useState(null);
  useEffect(() => {
    loadLastCallArchive().then((saved) => {
      if (saved) setLastCallArchive(saved);
    }).catch(() => {});
  }, []);
  const clearLastCallArchive = useCallback(async () => {
    setLastCallArchive(null);
    await clearLastCallArchiveStore();
  }, []);

  const saveCaptionsTimeoutRef = useRef(null);
  // v4.130.1: flush live captions synchronously when the page hides so an
  // update reload / refresh loses nothing (kills the 1s debounce window).
  useEffect(() => {
    const flushCaptions = () => {
      try {
        const cur = captionsRef.current;
        if (Array.isArray(cur) && cur.length > 0) idbSet('catint_captions_v2', cur);
      } catch (_) {}
    };
    const onVis = () => { if (document.visibilityState === 'hidden') flushCaptions(); };
    window.addEventListener('pagehide', flushCaptions);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flushCaptions);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  const updateCaptions = useCallback((newCaptionsOrFn) => {
    setCaptions(prev => {
      const next = typeof newCaptionsOrFn === 'function' ? newCaptionsOrFn(prev) : newCaptionsOrFn;
      
      // Debounced save to IndexedDB
      if (saveCaptionsTimeoutRef.current) clearTimeout(saveCaptionsTimeoutRef.current);
      saveCaptionsTimeoutRef.current = setTimeout(async () => {
        try {
          await idbSet('catint_captions_v2', next);
        } catch (e) {
          catError('[Session:save] Failed to save captions:', e);
        }
      }, 1000);
      
      return next;
    });
  }, []);

  const clearCaptions = useCallback(async () => {
    setCaptions([]);
    try {
      window.dispatchEvent(new CustomEvent('catint_captions_cleared'));
    } catch (_) {}
    try {
      await idbSet('catint_captions_v2', []);
    } catch (e) {}
  }, []);

  const purgeTranslationCache = useCallback(() => {
    // HIPAA: if the call ended, there is no reason to keep transcript/translation caches.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PURGE_KEYS_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      // non-fatal
    }
  }, []);

  const purgeNotesTrashAtEndOfDay = useCallback(() => {
    const prefix = 'catintassist_notes_trash:';
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
  }, []);

  const finalizeHipaaDisconnectClear = useCallback(async () => {
    // Prevent double-finalize.
    if (!hipaaGraceActiveRef.current) return;

    hipaaGraceActiveRef.current = false;
    if (hipaaGraceTimerRef.current) {
      clearTimeout(hipaaGraceTimerRef.current);
      hipaaGraceTimerRef.current = null;
    }

    // HIPAA: clear transcription/translation/pins and notes.
    await clearCaptions();

    try {
      window.dispatchEvent(new CustomEvent('catint_pinned_cleared'));
    } catch (e) {}

    // Notes: move live notes to trash (in case you want audit) then clear live UI.
    try {
      const liveNotes = localStorage.getItem('catintassist_notes') || '';
      if (liveNotes.trim().length > 0) {
        const trashKey = `catintassist_notes_trash:${new Date().toISOString()}`;
        localStorage.setItem(trashKey, liveNotes);
      }
      localStorage.setItem('catintassist_notes', '');
      window.dispatchEvent(new CustomEvent('catint_notes_cleared'));
    } catch (e) {}

    purgeTranslationCache();
    setHipaaGraceActive(false);
  }, [clearCaptions, purgeTranslationCache]);

  const requestHipaaDisconnectGrace = useCallback(
    (leewayMs = HIPAA_GRACE_MS_DEFAULT) => {
      // Mark grace active immediately for deepgram/notes effects.
      hipaaGraceActiveRef.current = true;
      setHipaaGraceActive(true);

      if (hipaaGraceTimerRef.current) {
        clearTimeout(hipaaGraceTimerRef.current);
        hipaaGraceTimerRef.current = null;
      }

      hipaaGraceTimerRef.current = setTimeout(() => {
        finalizeHipaaDisconnectClear();
      }, leewayMs);
    },
    [finalizeHipaaDisconnectClear],
  );

  const cancelHipaaDisconnectGrace = useCallback(() => {
    hipaaGraceActiveRef.current = false;
    setHipaaGraceActive(false);

    if (hipaaGraceTimerRef.current) {
      clearTimeout(hipaaGraceTimerRef.current);
      hipaaGraceTimerRef.current = null;
    }

    // One-shot: reconnect inside grace should not clear pinned messages.
    skipPinnedClearOnceRef.current = true;
  }, []);

  useEffect(() => {
    safeLocalStorageSet('catintassist_stats', JSON.stringify(stats));
  }, [stats]);

  const [holdIntentAt, setHoldIntentAt] = useState(0);

  const updateActivity = () => setLastActivityTime(Date.now());
  const updateEnglishActivity = () => setLastEnglishActivityTime(Date.now());
  const requestHoldIntent = () => setHoldIntentAt(Date.now());

  // ── AUTO-BREAK (v4.90.0): break counts ALL time with no transcription ──
  // Refs mirror state so the 1s auto-break loop never needs re-creating.
  const lastActivityTimeRef = useRef(lastActivityTime);
  const isHoldAutoRef = useRef(isHold);
  const isBreakActiveAutoRef = useRef(isBreakActive);
  const isZombieAutoRef = useRef(isZombieCall);
  // A break restored after refresh is treated as auto (speech ends it).
  const breakWasAutoRef = useRef(isBreakActive);
  const breakStintStartRef = useRef(Date.now());
  const manualBreakSuppressUntilRef = useRef(0);
  useEffect(() => { lastActivityTimeRef.current = lastActivityTime; }, [lastActivityTime]);
  useEffect(() => { isHoldAutoRef.current = isHold; }, [isHold]);
  useEffect(() => { isBreakActiveAutoRef.current = isBreakActive; }, [isBreakActive]);
  useEffect(() => { isZombieAutoRef.current = isZombieCall; }, [isZombieCall]);

  const recordTimelineEvent = useCallback((type) => {
    const now = Date.now();
    setDailyTimeline(prev => {
      // Close the previous event if it exists
      const newTimeline = [...prev];
      if (newTimeline.length > 0) {
        const last = newTimeline[newTimeline.length - 1];
        // If the new event is the same type as the last ongoing one, just keep it going
        if (last.type === type && !last.end) {
          return prev;
        }
        if (!last.end) {
          last.end = now;
        }
      }
      // Add the new event
      if (type !== 'none') {
        newTimeline.push({ type, start: now, end: null });
      }
      safeLocalStorageSet('catintassist_timeline', JSON.stringify(newTimeline));
      return newTimeline;
    });
  }, []);

  // Sync timeline to storage
  useEffect(() => { safeLocalStorageSet('catintassist_timeline', JSON.stringify(dailyTimeline)); }, [dailyTimeline]);
  useEffect(() => { safeLocalStorageSet('catintassist_history_timeline', JSON.stringify(historyTimeline)); }, [historyTimeline]);
  useEffect(() => { safeLocalStorageSet('catint_hold', JSON.stringify(isHold)); }, [isHold]);
  useEffect(() => { safeLocalStorageSet('catint_hold_sec', holdSeconds); }, [holdSeconds]);

  useEffect(() => { safeLocalStorageSet('catint_active', JSON.stringify(isActive)); }, [isActive]);
  useEffect(() => { safeLocalStorageSet('catint_s_sec', sessionSeconds); }, [sessionSeconds]);
  useEffect(() => { safeLocalStorageSet('catint_break', JSON.stringify(isBreakActive)); }, [isBreakActive]);
  useEffect(() => { safeLocalStorageSet('catint_b_sec', breakSeconds); }, [breakSeconds]);
  useEffect(() => { safeLocalStorageSet('catint_a_sec', availSeconds); }, [availSeconds]);

  const [isEditingScoreboard, setIsEditingScoreboard] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(() => JSON.parse(localStorage.getItem('catint_notes_open')) || false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(() => {
    // v4.32: soundboard hidden by default (one-time reset for existing users)
    const migrateKey = 'catint_soundboard_default_hidden_v432';
    if (!localStorage.getItem(migrateKey)) {
      localStorage.setItem('catint_toolbar_visible', 'false');
      localStorage.setItem(migrateKey, '1');
      return false;
    }
    const saved = localStorage.getItem('catint_toolbar_visible');
    return saved !== null ? JSON.parse(saved) : false;
  });
  // v4.113.0: workdays basis (5/6/6.5-day weeks) lifted here from DashboardHeader —
  // the Goal Tracking view writes it while the header stays mounted, so a header-local
  // copy would go stale. Same key + default as before (v4.100.1: 6.5/Wk = 28d).
  const [goalWorkDays, setGoalWorkDays] = useState(readStoredGoalWorkDays);
  useEffect(() => {
    try { localStorage.setItem(GOAL_WORKDAYS_KEY, String(goalWorkDays)); } catch {}
  }, [goalWorkDays]);
  // Ref mirror: the month-rollover interval re-derives next month's goal from
  // the current basis without re-creating the interval.
  const goalWorkDaysRef = useRef(goalWorkDays);
  useEffect(() => { goalWorkDaysRef.current = goalWorkDays; }, [goalWorkDays]);
  const [isScoreboardHelpVisible, setIsScoreboardHelpVisible] = useState(false);
  const [isCallDetectionEnabled, setIsCallDetectionEnabled] = useState(() => {
    const saved = localStorage.getItem('catint_call_detect');
    return saved === null ? true : saved === 'true';
  });
  const [callFocusMode, setCallFocusMode] = useState(() => {
    const saved = localStorage.getItem('catint_call_focus');
    return saved === null ? true : saved === 'true';
  });

  const [autoAttachEnabled, setAutoAttachEnabled] = useState(() => {
    const saved = localStorage.getItem('catint_auto_attach_enabled_v1');
    return saved === '1';
  });

  useEffect(() => { localStorage.setItem('catint_notes_open', JSON.stringify(isNotesOpen)); }, [isNotesOpen]);
  // v4.139.0: notes follow call state — open when a call starts, closed when it ends.
  // Manual 📝 toggle still works any time; the next call transition re-applies the default.
  useEffect(() => { setIsNotesOpen(isActive); }, [isActive]);
  useEffect(() => { localStorage.setItem('catint_toolbar_visible', JSON.stringify(isToolbarVisible)); }, [isToolbarVisible]);
  useEffect(() => { localStorage.setItem('catint_call_detect', JSON.stringify(isCallDetectionEnabled)); }, [isCallDetectionEnabled]);
  useEffect(() => { localStorage.setItem('catint_call_focus', JSON.stringify(callFocusMode)); }, [callFocusMode]);
  useEffect(() => {
    localStorage.setItem(
      'catint_auto_attach_enabled_v1',
      autoAttachEnabled ? '1' : '0',
    );
  }, [autoAttachEnabled]);

  // Post-Call Summary: extract key data when a call ends
  const [lastCallSummary, setLastCallSummary] = useState(null);
  // v4.124.0: last-call wall-clock + end stamp — powers the OFF-call
  // "how long was the last call / how long off call" HUD counters.
  const [lastCallSeconds, setLastCallSeconds] = useState(() => Number(localStorage.getItem('catint_last_call_secs')) || 0);
  const [lastCallEndedAt, setLastCallEndedAt] = useState(() => Number(localStorage.getItem('catint_last_call_ended_at')) || 0);
  useEffect(() => { safeLocalStorageSet('catint_last_call_secs', lastCallSeconds); }, [lastCallSeconds]);
  useEffect(() => { safeLocalStorageSet('catint_last_call_ended_at', lastCallEndedAt); }, [lastCallEndedAt]);

  const extractCallSummary = (callCaptions) => {
    if (!callCaptions || callCaptions.length === 0) return null;
    const allText = callCaptions.map(c => c.text).filter(Boolean).join(' ');
    const numbers = [];
    const numRegex = /(\+?\(?\d{1,4}?\)?[\s.-]?\(?\d{2,4}?\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\b\d+[\d.,/\\-]*\b)/g;
    let m;
    while ((m = numRegex.exec(allText)) !== null) {
      if (m[0].length >= 2) numbers.push(m[0]);
    }
    const uniqueNumbers = [...new Set(numbers)].slice(0, 8);
    const dollarMatches = allText.match(/\$\d[\d,]*/g) || [];
    const uniqueDollars = [...new Set(dollarMatches)].slice(0, 4);
    return {
      duration: callCaptions[callCaptions.length - 1]?.turnWordCount || 0,
      numbers: uniqueNumbers,
      dollars: uniqueDollars,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    };
  };

  const [visibleCards, setVisibleCards] = useState(() => {
    const saved = localStorage.getItem('catintassist_visible_cards');
    return saved ? JSON.parse(saved) : { month: true, moneyMonth: true, today: true, moneyToday: true, call: true, break: true, avail: true, goal: true };
  });

  useEffect(() => {
    safeLocalStorageSet('catintassist_visible_cards', JSON.stringify(visibleCards));
  }, [visibleCards]);

  const toggleCard = (key) => setVisibleCards(v => ({ ...v, [key]: !v[key] }));

  const [scoreboardPreset, setScoreboardPreset] = useState(() => loadPreset());
  const [visibleMetrics, setVisibleMetrics] = useState(() => loadVisibleMetrics());

  useEffect(() => {
    saveVisibleMetrics(visibleMetrics);
  }, [visibleMetrics]);

  const toggleMetric = (key) => setVisibleMetrics(v => ({ ...v, [key]: !v[key] }));

  const applyScoreboardPreset = useCallback((presetId) => {
    const cfg = getPresetConfig(presetId);
    if (!cfg) return;
    setScoreboardPreset(presetId);
    savePreset(presetId);
    setVisibleCards(cfg.visibleCards);
    setVisibleMetrics(cfg.visibleMetrics);
  }, []);

  // GUARDAMOS TODO: daily log tracks minutes per calendar day for the heatmap.
  const [dailyLog, setDailyLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem('catintassist_daily_log')) || {}; } catch(e) { return {}; }
  });
  useEffect(() => { safeLocalStorageSet('catintassist_daily_log', JSON.stringify(dailyLog)); }, [dailyLog]);

  // Write today's final minutes into dailyLog (called on endDay or midnight rollover)
  const commitDayToLog = useCallback((dateStr, minutes) => {
    setDailyLog(prev => ({ ...prev, [dateStr]: Math.round(minutes) }));
  }, []);

  // v4.96.5: hand-edit a PAST day (heatmap pebble editor) — writes the log AND
  // syncs stats so the deficit chip / catch-up plan see the correction.
  const editPastDay = useCallback((dateStr, minutes) => {
    const mins = Math.max(0, Math.round(Number(minutes) || 0));
    const old = Math.round(dailyLog[dateStr] || 0);
    if (old === mins) return;
    const nextLog = { ...dailyLog, [dateStr]: mins };
    setDailyLog(nextLog);
    safeLocalStorageSet('catintassist_daily_log', JSON.stringify(nextLog));
    if (!isDateInCurrentMonth(dateStr)) return;
    setStats((prev) => {
      const next = applyDayEditToStats(prev, { oldMinutes: old, newMinutes: mins, isCurrentMonth: true });
      const newStats = { ...prev, monthlyMinutes: next.monthlyMinutes, weeklyMinutes: next.weeklyMinutes };
      safeLocalStorageSet('catintassist_stats', JSON.stringify(newStats));
      return newStats;
    });
  }, [dailyLog]);

  // Company call-log paste import (v4.87.0): company rows are source of truth.
  // Past days overwrite dailyLog + historyTimeline (monthly gets the delta only);
  // today is authoritative for dailyMinutes/callsToday (correction may go down).
  const importCallLog = useCallback((days) => {
    if (!Array.isArray(days) || !days.length) return { days: 0, totalMins: 0, totalCalls: 0 };
    const now = new Date();
    const todayStr = now.toDateString();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    // Single direct merge: this codebase treats synchronous localStorage as the
    // durability source, and stats/log/history all persist there on every change.
    const out = mergeImportedDays({
      dailyLog: JSON.parse(localStorage.getItem('catintassist_daily_log') || '{}'),
      historyTimeline: JSON.parse(localStorage.getItem('catintassist_history_timeline') || '{}'),
      stats: JSON.parse(localStorage.getItem('catintassist_stats') || '{}'),
      days,
      todayStr,
      currentMonthKey,
    });
    setDailyLog(out.dailyLog);
    setHistoryTimeline(out.historyTimeline);
    setStats(out.stats);
    safeLocalStorageSet('catintassist_daily_log', JSON.stringify(out.dailyLog));
    safeLocalStorageSet('catintassist_history_timeline', JSON.stringify(out.historyTimeline));
    safeLocalStorageSet('catintassist_stats', JSON.stringify(out.stats));
    return out.summary;
  }, []);

  // v4.100.0: month-total truth check — re-sum the daily log so a drifted
  // monthlyMinutes (the "-77h?!" scare) can be fixed in 2 clicks.
  // Convention: monthly = Σ past days in dailyLog (current month, excl. today)
  // + today's live stats.dailyMinutes (log may or may not mirror today yet).
  const getMonthResyncPreview = useCallback(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    let log = {};
    try { log = JSON.parse(localStorage.getItem('catintassist_daily_log') || '{}'); } catch { log = {}; }
    let pastSum = 0;
    Object.entries(log).forEach(([dateStr, mins]) => {
      if (dateStr === todayStr) return;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return;
      if (`${d.getFullYear()}-${d.getMonth()}` !== currentMonthKey) return;
      pastSum += Number(mins) || 0;
    });
    let statsNow = {};
    try { statsNow = JSON.parse(localStorage.getItem('catintassist_stats') || '{}'); } catch { statsNow = {}; }
    const sum = Math.round(pastSum + (Number(statsNow.dailyMinutes) || 0));
    return { sum, pastSum: Math.round(pastSum), today: Math.round(Number(statsNow.dailyMinutes) || 0) };
  }, []);

  const reconcileMonthTotal = useCallback(() => {
    const preview = getMonthResyncPreview();
    setStats((prev) => {
      const newStats = { ...prev, monthlyMinutes: preview.sum };
      safeLocalStorageSet('catintassist_stats', JSON.stringify(newStats));
      return newStats;
    });
    return { sum: preview.sum, applied: true };
  }, [getMonthResyncPreview]);


  const [workSessionStartTime, setWorkSessionStartTime] = useState(() => stats.lastBreakEndTime || stats.dayStartTime || Date.now());
  const [workSessionMinutes, setWorkSessionMinutes] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, (now - workSessionStartTime) / 60000);
      setWorkSessionMinutes(diff);
    }, 10000);
    return () => clearInterval(iv);
  }, [workSessionStartTime]);

  const [arsRate, setArsRate] = useState(1050);

  // ----- CLOUD SYNC LOGIC (ntfy.sh zero-auth) -----
  // DELETED: Cloud sync vector was causing zero-state race conditions when empty local environments overwrote populated production environments.
  // The app now relies exclusively on synchronous localStorage to guarantee state durability per browser.
  // -------------------------------------------------

  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(res => res.json())
      .then(data => {
        if (data && data.rates && data.rates.ARS) {
          setArsRate(data.rates.ARS);
        }
      })
      .catch(err => catError("[Session:fx] Failed to fetch ARS rate:", err));
  }, []);

  const RATE_PER_MINUTE = 0.13;
  const timerRef = useRef(null);
  const accumulatorRef = useRef(0); // collects fractional seconds

  const commitAvailTime = () => {
    setAvailSeconds(currentAvail => {
      if (currentAvail > 0) {
        const minutesToAdd = currentAvail / 60;
        setStats(prev => {
          const newStats = { ...prev, dailyAvailMinutes: (prev.dailyAvailMinutes || 0) + minutesToAdd };
          safeLocalStorageSet('catintassist_stats', JSON.stringify(newStats));
          return newStats;
        });
      }
      return 0;
    });
  };

  // v4.90.0: bank live break seconds into dailyBreakMinutes and zero the live
  // counter (single ledger — keeps OFF CALL / break chips free of double count).
  const bankBreakSeconds = useCallback(() => {
    setBreakSeconds(current => {
      if (current <= 0) return current;
      const minutesToAdd = current / 60;
      setStats(prev => {
        const newStats = {
          ...prev,
          dailyBreakMinutes: (prev.dailyBreakMinutes || 0) + minutesToAdd,
          lastBreakEndTime: Date.now(),
        };
        safeLocalStorageSet('catintassist_stats', JSON.stringify(newStats));
        return newStats;
      });
      return 0;
    });
  }, []);

  // v4.99.0: bank live off-call/break seconds every minute so a crash or browser
  // kill loses at most 60s. commitAvailTime is closure-stable (setters only).
  useEffect(() => {
    const banking = setInterval(() => {
      commitAvailTime();
      bankBreakSeconds();
    }, 60000);
    return () => clearInterval(banking);
  }, [bankBreakSeconds]);

  // Timer for Hold
  useEffect(() => {
    let iv;
    if (isHold && isActive) {
      iv = setInterval(() => setHoldSeconds(s => s + 1), 1000);
    } else {
      setHoldSeconds(0);
    }
    return () => clearInterval(iv);
  }, [isHold, isActive]);

  // EMPEZAR LLAMADA: Dejamos de descansar y empezamos a contar los minutos de la llamada.
  const startSession = (isRecovery = false) => {
    // v4.87.2: guard — a second start while active wipes sessionSeconds/timeline.
    if (isActive && !isRecovery) return;
    // v4.92.0: auto-start within the 15s HIPAA grace MUST cancel the finalizer,
    // or it wipes the live transcript mid-call. Idempotent for manual paths.
    cancelHipaaDisconnectGrace();
    updateActivity();
    setLastEnglishActivityTime(Date.now());
    callHadSpeechRef.current = false;
    callLastSpeechAtRef.current = Date.now();
    
    // Logic fix: If a call starts while on break, automatically end the break.
    if (isBreakActive) {
      stopBreak();
    }
    // v4.90.0: work resumed — clear the STOP BREAK suppression so post-call
    // idle counts as break again.
    manualBreakSuppressUntilRef.current = 0;

    // v4.99.2: open-across-midnight seal — never bank counters carried over
    // from a previous day (the day tag only wipes them on reload).
    const todayTag = new Date().toDateString();
    if (liveCountersDayRef.current !== todayTag) {
      liveCountersDayRef.current = todayTag;
      try {
        localStorage.setItem(COUNTERS_DAY_KEY, todayTag);
        LIVE_COUNTER_KEYS.forEach((k) => localStorage.removeItem(k));
      } catch (_) {}
      setAvailSeconds(0);
      setBreakSeconds(0);
      setLastCallSeconds(0);
      setLastCallEndedAt(0);
    }

    commitAvailTime();
    
    if (!isRecovery) {
      // v4.86.8: pins now PERSIST across calls (product decision).
      // Consume the one-shot skip flag so stale state never accumulates.
      if (skipPinnedClearOnceRef.current) skipPinnedClearOnceRef.current = false;
      // v4.130.1: a new call expires the previous last-call seal.
      setLastCallArchive(null);
      clearLastCallArchiveStore().catch(() => {});
      setSessionSeconds(0);
      accumulatorRef.current = 0;
    }
    
    
    setIsActive(true);
    setIsHold(false);
    recordTimelineEvent('work');
    
    initRewardAudio();
    playPurseOpen();
    
    // Catch-up logic: record the very first time we start working today
    setStats(prev => {
      const now = Date.now();
      const today = new Date().toDateString();
      const isNewDay = prev.lastDate && prev.lastDate !== today;
      
      if (!prev.dayStartTime || isNewDay) {
        const nineAM = new Date();
        nineAM.setHours(9, 0, 0, 0);
        const lateMins = Math.max(0, (now - nineAM.getTime()) / 60000);
        
        setWorkSessionStartTime(now);
        const timelineStart = Math.min(now, nineAM.getTime());
        
        // Initialize timeline and start work in one go to prevent race condition
        const initialTimeline = [
          { type: 'avail', start: timelineStart, end: now },
          { type: 'work', start: now, end: null }
        ];
        setDailyTimeline(initialTimeline);
        safeLocalStorageSet('catintassist_timeline', JSON.stringify(initialTimeline));
        
        return { ...prev, dayStartTime: now, lastDate: today, shiftStartSentiment: lateMins };
      }
      
      // If not a new day, just record the work event normally (handled by line 250)
      return prev;
    });
  };
  const startSessionRef = useRef(startSession);
  startSessionRef.current = startSession;
  
  const notifySpeechDuringCall = useCallback(() => {
    callHadSpeechRef.current = true;
    callLastSpeechAtRef.current = Date.now();
  }, []);

  // v4.87.2: ref-based guard. Deepgram socket closures capture this callback at
  // connect time, so a stale `isActive` here re-ran startSession on every
  // transcript after speech auto-start (timer reset to 0, work events spam).
  const isActiveStateRef = useRef(isActive);
  useEffect(() => {
    isActiveStateRef.current = isActive;
  }, [isActive]);

  // v4.92.0: live toggle for auto-start (socket closures read the ref).
  const isCallDetectionEnabledRef = useRef(isCallDetectionEnabled);
  useEffect(() => {
    isCallDetectionEnabledRef.current = isCallDetectionEnabled;
  }, [isCallDetectionEnabled]);

  const trySpeechAutoStart = useCallback(() => {
    // v4.92.0: call-detect toggle OFF also disables speech auto-start.
    // v4.98.0: autopilot ON takes over — only ring/bridge phrases start a call.
    if (!speechAutoConnectRef.current || !isCallDetectionEnabledRef.current || isActiveStateRef.current) return false;
    if (callAutopilotRef.current) return false;
    startSessionRef.current(false);
    return true;
  }, []);

  // ── CALL AUTOPILOT callbacks (v4.98.0) — placed after the refs they close
  // over (startSessionRef, isActiveStateRef, isHoldAutoRef, isZombieAutoRef).

  // When the current call started — end phrases inside the first minute are
  // echo/overlap and are ignored (AUTOPILOT_MIN_CALL_SECS).
  const callStartAtRef = useRef(0);
  useEffect(() => {
    if (isActive) callStartAtRef.current = Date.now();
  }, [isActive]);

  // 10s cancellable auto-end deadline (0 = none). AutopilotGuard renders the banner.
  const [autopilotEndsAt, setAutopilotEndsAt] = useState(0);
  const autopilotEndsAtRef = useRef(0);
  const autopilotCooldownUntilRef = useRef(0);
  const [autopilotEvent, setAutopilotEvent] = useState('');
  const setAutopilotDeadline = useCallback((at) => {
    autopilotEndsAtRef.current = at;
    setAutopilotEndsAt(at);
  }, []);

  // v4.146.0: human farewell heard — arms a silence-gated auto-end. The
  // matcher/spec shipped v4.132.0 but the transcript→arm wiring was never
  // connected, so farewells ("thank you, have a good day") never ended a
  // call. Any speech resets the window (callLastSpeechAtRef); firing opens
  // the same 10s cancellable banner as a platform disconnect phrase.
  const [autopilotFarewellAt, setAutopilotFarewellAt] = useState(0);
  const autopilotFarewellAtRef = useRef(0);

  const tryAutopilotStart = useCallback(() => {
    const ok = canAutopilotStart({
      enabled: callAutopilotRef.current,
      isActive: isActiveStateRef.current,
      isZombie: isZombieAutoRef.current,
      cooldownRemainsMs: autopilotCooldownUntilRef.current - Date.now(),
    });
    if (!ok) return false;
    setAutopilotDeadline(0); // a fresh call cancels any dangling end countdown
    autopilotFarewellAtRef.current = 0; // …and any armed farewell (v4.146.0)
    setAutopilotFarewellAt(0);
    startSessionRef.current(false);
    setAutopilotEvent(`auto-START · ${new Date().toLocaleTimeString()}`);
    return true;
  }, [setAutopilotDeadline]);

  /** End phrase heard → open the 10s cancellable countdown. */
  const requestAutopilotEnd = useCallback(() => {
    const ok = canAutopilotEnd({
      enabled: callAutopilotRef.current,
      isActive: isActiveStateRef.current,
      isHold: isHoldAutoRef.current,
      callAgeSecs: (Date.now() - callStartAtRef.current) / 1000,
    });
    if (!ok) return false;
    if (autopilotEndsAtRef.current) return true; // already counting down
    setAutopilotDeadline(Date.now() + AUTOPILOT_END_COUNTDOWN_MS);
    setAutopilotEvent(`auto-END armed · ${new Date().toLocaleTimeString()}`);
    return true;
  }, [setAutopilotDeadline]);

  /** "Keep call" button — cancel the countdown and ignore end phrases briefly. */
  const cancelAutopilotEnd = useCallback(() => {
    if (!autopilotEndsAtRef.current) return;
    setAutopilotDeadline(0);
    autopilotCooldownUntilRef.current = Date.now() + AUTOPILOT_START_COOLDOWN_MS;
  }, [setAutopilotDeadline]);

  /** Countdown expired — AutopilotGuard stops the call, then confirms here. */
  const consumeAutopilotEnd = useCallback(() => {
    if (!autopilotEndsAtRef.current) return false;
    setAutopilotDeadline(0);
    autopilotCooldownUntilRef.current = Date.now() + AUTOPILOT_START_COOLDOWN_MS;
    setAutopilotEvent(`auto-END fired · ${new Date().toLocaleTimeString()}`);
    return true;
  }, [setAutopilotDeadline]);

  /** v4.146.0: farewell phrase heard → arm the silence-gated auto-end. */
  const armAutopilotFarewell = useCallback(() => {
    if (!callAutopilotRef.current || !isActiveStateRef.current) return false;
    if (autopilotEndsAtRef.current || autopilotFarewellAtRef.current) return true; // already ending/armed
    autopilotFarewellAtRef.current = Date.now();
    setAutopilotFarewellAt(autopilotFarewellAtRef.current);
    setAutopilotEvent(`farewell heard · ${new Date().toLocaleTimeString()}`);
    return true;
  }, []);

  // Farewell armed → wait AUTOPILOT_FAREWELL_SILENCE_MS of NO speech, then
  // open the standard 10s cancellable end countdown. notifySpeechDuringCall
  // keeps callLastSpeechAtRef fresh, so any speech in the window pushes the
  // fire time forward (a farewell mid-conversation never cuts a live call).
  useEffect(() => {
    if (!autopilotFarewellAt) return undefined;
    const iv = setInterval(() => {
      if (Date.now() - callLastSpeechAtRef.current < AUTOPILOT_FAREWELL_SILENCE_MS) return;
      autopilotFarewellAtRef.current = 0;
      setAutopilotFarewellAt(0);
      requestAutopilotEnd();
    }, 2000);
    return () => clearInterval(iv);
  }, [autopilotFarewellAt, requestAutopilotEnd]);
  // ────────────────────────────────────────────────────────────────────────

  // TERMINAR LLAMADA: Guardamos los minutos que trabajamos para no perderlos.
  const stopSession = (onCallEnded) => {
    setIsActive(false);
    // Clear revenant/re-attach gate — STOP must not leave zombie banner/capture gate.
    clearZombieState();
    // v4.146.0: STOP also clears an armed farewell / pending end countdown.
    autopilotFarewellAtRef.current = 0;
    setAutopilotFarewellAt(0);
    setAutopilotDeadline(0);
    const summary = extractCallSummary(captionsRef.current);
    // v4.99.2: flag calls that will bank wall-clock (no STT speech, ≥60s).
    const bankedNoStt = !callHadSpeechRef.current && sessionSeconds >= 60;
    if (summary && (summary.numbers.length > 0 || summary.dollars.length > 0)) {
      setLastCallSummary({ ...summary, noStt: bankedNoStt });
    }

    let keptTranscriptVisible = false; // v4.133.0 — skipping the wipe path below.
    // v4.130.1: seal a read-only last-call copy BEFORE the wipe — the call
    // ended but the transcript must stay readable until next call/End Day.
    // v4.133.0 HARD RULE: the wipe below NEVER runs without the seal. If the
    // transcript is non-empty and no archive was produced, keep the text on
    // screen — losing an ER trauma report is worse than keeping PHI visible
    // until the next session teardown.
    if (isSealableArchive(captionsRef.current)) {
      const sealed = buildLastCallArchive(captionsRef.current);
      setLastCallArchive(sealed);
      saveLastCallArchive(captionsRef.current).catch(() => {});
    } else if (captionsRef.current?.length) {
      // Belt-and-braces: keep text visible rather than wiping it. Billing and
      // timers below still stop — only the destructive lines are skipped.
      keptTranscriptVisible = true;
    }
    if (!keptTranscriptVisible) {
      // HIPAA/UX: wipe transcript log as soon as the call ends (summary already captured + archive sealed above).
      // v4.86.8: pinned messages PERSIST across calls — they are references, not PHI dumps.
      clearCaptions();
      purgeTranslationCache();
      requestHipaaDisconnectGrace();
    }

    const trailingSilenceSecs = Math.max(0, (Date.now() - callLastSpeechAtRef.current) / 1000);
    // v4.99.2: pure billing rule (unit-tested in callBilling.test.js) —
    // no STT speech but a real call (≥60s) banks wall-clock; a Deepgram
    // outage must not erase a worked day (the "156m month" bug).
    const billableSecs = billableSecondsForCall({
      hadSpeech: callHadSpeechRef.current,
      sessionSeconds,
      trailingSilenceSecs,
    });
    if (!callHadSpeechRef.current) {
      setLastSilenceDeductionMins(bankedNoStt ? 0 : sessionSeconds / 60);
    } else if (trailingSilenceSecs > 30) {
      setLastSilenceDeductionMins(trailingSilenceSecs / 60);
    } else {
      setLastSilenceDeductionMins(0);
    }

    const minutesToAdd = billableSecs / 60;
    if (minutesToAdd > 0) {
      setStats(prev => {
        const today = new Date().toDateString();
        const isNewDay = prev.lastDate && prev.lastDate !== today;
        const newDailyMins = (isNewDay ? 0 : (prev.dailyMinutes || 0)) + minutesToAdd;
        const newCallsToday = (isNewDay ? 0 : (prev.callsToday || 0)) + 1;
        const newStats = {
          ...prev,
          dailyMinutes: newDailyMins,
          weeklyMinutes: (prev.weeklyMinutes || 0) + minutesToAdd,
          monthlyMinutes: (prev.monthlyMinutes || 0) + minutesToAdd,
          callsToday: newCallsToday,
          lastDate: today
        };
        safeLocalStorageSet('catintassist_stats', JSON.stringify(newStats));
        return newStats;
      });
      if (onCallEnded) onCallEnded(minutesToAdd);
      playCoinStack(minutesToAdd);
    }
    // v4.124.0: snapshot the finished call for the OFF-call HUD counters
    // (wall-clock length + end stamp) BEFORE zeroing the live timer.
    const finishedCallSecs = Math.max(0, Math.floor(sessionSeconds || 0));
    const finishedCallAt = Date.now();
    setLastCallSeconds(finishedCallSecs);
    setLastCallEndedAt(finishedCallAt);
    safeLocalStorageSet('catint_last_call_secs', finishedCallSecs);
    safeLocalStorageSet('catint_last_call_ended_at', finishedCallAt);
    // v4.99.2: the call is banked — zero the live timer so a later zombie
    // re-attach (startSession(true)) can never bank the same call twice.
    setSessionSeconds(0);
    accumulatorRef.current = 0;
    safeLocalStorageSet('catint_s_sec', 0);
    setIsHold(false);
    // If we stop session, we default to 'avail' unless we immediately start a break
    recordTimelineEvent('avail');
  };

  // End of Day: commit daily total to log, check streak, reset counters
  const endDay = (onDayEnded) => {
    // HIPAA: ensure residual notes trash is destroyed at latest.
    // v4.86.8: pins persist — no longer wiped at end of day.
    purgeNotesTrashAtEndOfDay();
    // v4.130.1: End Day expires the last-call seal too.
    setLastCallArchive(null);
    clearLastCallArchiveStore().catch(() => {});

    commitAvailTime();
    setStats(prev => {
      // Write today into daily log before zeroing
      const todayStr = prev.lastDate || new Date().toDateString();
      commitDayToLog(todayStr, prev.dailyMinutes);

      // Archive timeline
      setHistoryTimeline(h => {
        const newH = { ...h, [todayStr]: dailyTimeline };
        safeLocalStorageSet('catintassist_history_timeline', JSON.stringify(newH));
        return newH;
      });

      const dailyGoalProxy = prev.goalMinutes > 0 && prev.monthlyMinutes > 0
        ? Math.ceil((prev.goalMinutes - (prev.monthlyMinutes - prev.dailyMinutes)) /
            Math.max(1, new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate() + 1))
        : 0;
      const metGoal = prev.dailyMinutes >= dailyGoalProxy && dailyGoalProxy > 0;
      const newStreak = metGoal ? (prev.streak || 0) + 1 : 0;

      const newStats = {
        ...prev,
        dailyMinutes: 0,
        dailyBreakMinutes: 0,
        dailyAvailMinutes: 0,
        callsToday: 0,
        dayStartTime: null,
        streak: newStreak,
        lastDate: new Date().toDateString()
      };
      safeLocalStorageSet('catintassist_stats', JSON.stringify(newStats));
      
      // Clear current timeline
      setDailyTimeline([]);
      safeLocalStorageSet('catintassist_timeline', JSON.stringify([]));

      if (onDayEnded) onDayEnded(prev.dailyMinutes);
      return newStats;
    });
  };

  // MIDNIGHT AUTO-LOGOFF: if break is running and clock crosses 00:00, stop break
  useEffect(() => {
    const midnightGuard = setInterval(() => {
      const h = new Date().getHours();
      const m = new Date().getMinutes();
      // Trigger at 00:00–00:01 window
      if (h === 0 && m === 0 && isBreakActive) {
        breakWasAutoRef.current = false;
        setIsBreakActive(false);
        bankBreakSeconds();
      }
    }, 30000); // check every 30s is sufficient
    return () => clearInterval(midnightGuard);
  }, [isBreakActive, bankBreakSeconds]);

  useEffect(() => {
    safeLocalStorageSet('catintassist_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSessionSeconds(prev => prev + 1);

        // SMART HOLD AUTO-TRIGGER + AUTO-RESUME (v4.89.1: speech = back)
        // Hold phrase recently detected (<30s) + silence (>3s) → hold.
        // Any speech while holding (<2s silence) → resume.
        const silenceSecs = (Date.now() - lastActivityTime) / 1000;
        const holdIntentAgeMs = Date.now() - holdIntentAt;

        if (shouldAutoResume({ isHold, silenceSecs })) {
          setIsHold(false);
        } else if (shouldAutoHold({ isHold, holdIntentAgeMs, silenceSecs })) {
          setIsHold(true);
          // Reset intent so it doesn't trigger again immediately if they speak and stop
          setHoldIntentAt(0);
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, lastActivityTime, holdIntentAt, isHold]);

  const breakTimerRef = useRef(null);
  useEffect(() => {
    if (isBreakActive) {
      breakTimerRef.current = setInterval(() => {
        setBreakSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    }
    return () => {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    };
  }, [isBreakActive]);

  // Month guard (reset monthlyMinutes when calendar month changes)
  useEffect(() => {
    const monthGuard = setInterval(() => {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
      setStats(prev => {
        if (!prev || prev.lastMonthKey === monthKey) return prev;
        // ANCHORED-GOAL: same commitment, fresh month → full-month quota again.
        const goalRoll = rollGoalForNewMonth(prev, goalWorkDaysRef.current, now);
        return { ...prev, monthlyMinutes: 0, weeklyMinutes: 0, shiftStartSentiment: 0, lastMonthKey: monthKey, ...goalRoll };
      });
    }, 30000);
    return () => clearInterval(monthGuard);
  }, []);

  // v4.99.0: live day rollover — a tab open across midnight archives yesterday
  // exactly like the mount-time stats logic (timeline → history, minutes → log).
  // Reads localStorage (the durability source) to avoid stale closures, same
  // idiom as importCallLog.
  useEffect(() => {
    const dayGuard = setInterval(() => {
      try {
        const todayStr = new Date().toDateString();
        const rolled = rollDaySnapshot({
          stats: JSON.parse(localStorage.getItem('catintassist_stats') || '{}'),
          dailyLog: JSON.parse(localStorage.getItem('catintassist_daily_log') || '{}'),
          historyTimeline: JSON.parse(localStorage.getItem('catintassist_history_timeline') || '{}'),
          timeline: JSON.parse(localStorage.getItem('catintassist_timeline') || '[]'),
          todayStr,
        });
        if (!rolled) return;
        safeLocalStorageSet('catintassist_daily_log', JSON.stringify(rolled.dailyLog));
        safeLocalStorageSet('catintassist_history_timeline', JSON.stringify(rolled.historyTimeline));
        safeLocalStorageSet('catintassist_stats', JSON.stringify(rolled.stats));
        safeLocalStorageSet('catintassist_timeline', JSON.stringify([]));
        setDailyLog(rolled.dailyLog);
        setHistoryTimeline(rolled.historyTimeline);
        setStats(rolled.stats);
        setDailyTimeline([]);
        setHoldSeconds(0);
        // v4.101.2: seal LIVE counters on live rollover — the avail ticker pauses
        // 00:00–09:00 (h>=9 gate) but keeps yesterday's leftover in availSeconds;
        // at 9:00 the 60s banker poured it into TODAY's dailyAvailMinutes
        // (the "632m off-call on a <8h shift" scare). Same seal as startSession.
        liveCountersDayRef.current = todayStr;
        try {
          localStorage.setItem(COUNTERS_DAY_KEY, todayStr);
          LIVE_COUNTER_KEYS.forEach((k) => localStorage.removeItem(k));
        } catch (_) {}
        setAvailSeconds(0);
        setBreakSeconds(0);
        setSessionSeconds(0);
        setLastCallSeconds(0);
        setLastCallEndedAt(0);
      } catch (e) {
        catWarn('[Session:rollover] Day rollover failed:', e);
      }
    }, 30000);
    return () => clearInterval(dayGuard);
  }, []);

  // v4.99.0: a cloud pull (sign-in) merged missing past days → re-hydrate the
  // in-memory mirrors so the scoreboard/heatmap see them immediately.
  useEffect(() => {
    const onCloudMerge = () => {
      try {
        setDailyLog(JSON.parse(localStorage.getItem('catintassist_daily_log') || '{}'));
        setHistoryTimeline(JSON.parse(localStorage.getItem('catintassist_history_timeline') || '{}'));
      } catch (e) { /* non-fatal */ }
    };
    window.addEventListener(TIMETRACK_CHANGED_EVENT, onCloudMerge);
    return () => window.removeEventListener(TIMETRACK_CHANGED_EVENT, onCloudMerge);
  }, []);

  const availTimerRef = useRef(null);
  useEffect(() => {
    const checkAndAdvance = () => {
      const h = new Date().getHours();
      // Avail only runs between 9:00 AM and 11:59 PM (00hs stop)
      const isWorkHours = h >= 9; 

      if (!isActive && !isBreakActive && isWorkHours) {
        setAvailSeconds(prev => prev + 1);
      }
    };

    availTimerRef.current = setInterval(checkAndAdvance, 1000);
    return () => {
      if (availTimerRef.current) clearInterval(availTimerRef.current);
    };
  }, [isActive, isBreakActive]);

  const startBreak = () => {
    // v4.90.0: auto-break may already be counting — never reset the live counter.
    if (isActive || isBreakActive) return;
    commitAvailTime();
    breakWasAutoRef.current = false;
    breakStintStartRef.current = Date.now();
    setIsBreakActive(true);
    recordTimelineEvent('break');
  };
  
  const stopBreak = () => {
    updateActivity(); // <--- Reset silence timer when returning to work
    // v4.90.0: grace so auto-break doesn't instantly re-engage after STOP BREAK
    manualBreakSuppressUntilRef.current = Date.now() + MANUAL_BREAK_SUPPRESS_MS;
    breakWasAutoRef.current = false;
    setIsBreakActive(false);
    recordTimelineEvent('avail');
    bankBreakSeconds();
    setWorkSessionStartTime(Date.now()); // deliberate break → restart "working without break"
  };

  // ── AUTO-BREAK ENGINE (v4.90.0) ─────────────────────────────────────────
  // Break counts EVERY second with no transcription detected (≥3s silence),
  // unless hold (provider keywords: "one moment", "please hold", …) is active.
  // Works off-call AND on dead-air mid-call; ends the moment transcription
  // resumes or hold starts. STOP BREAK suppresses it for 10 min (desk work).
  const engageAutoBreak = useCallback(() => {
    breakWasAutoRef.current = true;
    breakStintStartRef.current = Date.now();
    setIsBreakActive(true);
    if (!isActiveStateRef.current) {
      commitAvailTime();            // flush pending idle-avail seconds
      recordTimelineEvent('break'); // timeline only tracks off-call break
    }
  }, [commitAvailTime, recordTimelineEvent]);

  const disengageAutoBreak = useCallback(() => {
    breakWasAutoRef.current = false;
    setIsBreakActive(false);
    if (!isActiveStateRef.current) recordTimelineEvent('avail');
    bankBreakSeconds();
    // Long idle gap (≥5 min) → restart "minutes working without break" nudge
    const stintSecs = (Date.now() - breakStintStartRef.current) / 1000;
    if (shouldResetWorkTimer(stintSecs)) setWorkSessionStartTime(Date.now());
  }, [bankBreakSeconds, recordTimelineEvent]);

  const engageAutoBreakRef = useRef(engageAutoBreak);
  const disengageAutoBreakRef = useRef(disengageAutoBreak);
  engageAutoBreakRef.current = engageAutoBreak;
  disengageAutoBreakRef.current = disengageAutoBreak;

  useEffect(() => {
    const iv = setInterval(() => {
      const silenceSecs = (Date.now() - lastActivityTimeRef.current) / 1000;
      const h = new Date().getHours(); // mirror avail window: no auto-break before 9am
      const due =
        h >= 9 &&
        Date.now() >= manualBreakSuppressUntilRef.current &&
        !isZombieAutoRef.current &&
        shouldAutoBreak({ isHold: isHoldAutoRef.current, silenceSecs });
      if (due && !isBreakActiveAutoRef.current) {
        engageAutoBreakRef.current();
      } else if (!due && isBreakActiveAutoRef.current && breakWasAutoRef.current) {
        disengageAutoBreakRef.current();
      }
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  // ────────────────────────────────────────────────────────────────────────

  const updateStat = (key, value) => {
    setStats((prev) => ({ ...prev, [key]: Number(value) }));
  };

  /**
   * ANCHORED-GOAL: bank a goal so it counts FROM NOW.
   * One write, so `goalMinutes` and its anchor can never land apart:
   *   goalMinutes      = month total to reach (worked so far + commitment × workdays left)
   *   goalSetAt        = the day the pace clock starts
   *   goalBaseMinutes  = minutes already worked at that moment (deficit starts at 0)
   *   goalPerWorkdayMinutes = commitment, reused to re-derive next month's quota
   * Returns the anchor that was written.
   */
  const bankGoal = useCallback(({
    targetMinutes,
    workDays = 0,
    perWorkdayMinutes = 0,
    baseMinutes = 0,
  } = {}) => {
    const now = new Date();
    const target = Math.round(Number(targetMinutes) || 0);
    const anchor = buildGoalAnchor({
      targetMinutes: target,
      bankedMinutes: baseMinutes,
      perWorkdayMinutes,
      workDays,
      now,
    });
    if (isGoalWorkDays(workDays)) setGoalWorkDays(Number(workDays));
    setStats((prev) => {
      const next = { ...prev, goalMinutes: target, ...anchor };
      safeLocalStorageSet('catintassist_stats', JSON.stringify(next));
      return next;
    });
    return anchor;
  }, []);

  /** Retroactive daily edit — keeps monthly + progress bar in sync. */
  const adjustDailyMinutes = (newDailyMinutes) => {
    setStats((prev) => {
      const delta = Number(newDailyMinutes) - (prev.dailyMinutes || 0);
      const newStats = {
        ...prev,
        dailyMinutes: Number(newDailyMinutes),
        monthlyMinutes: Math.max(0, (prev.monthlyMinutes || 0) + delta),
        weeklyMinutes: Math.max(0, (prev.weeklyMinutes || 0) + delta),
      };
      safeLocalStorageSet('catintassist_stats', JSON.stringify(newStats));
      return newStats;
    });
  };

  const getCompensatedLogOff = () => {
    if (!stats.dayStartTime) return '18:00';
    // Shift ends at 18:00 + (minutes late from 9am) + (total break minutes used)
    const lateMs = (stats.shiftStartSentiment || 0) * 60000;
    const breakMs = (stats.dailyBreakMinutes || 0) * 60000;
    
    const baseEnd = new Date(stats.lastDate || new Date().toDateString());
    baseEnd.setHours(18, 0, 0, 0);
    
    const finalEnd = new Date(baseEnd.getTime() + lateMs + breakMs);
    return finalEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const minutesSinceLastBreak = Math.max(0, (Date.now() - workSessionStartTime) / 60000);

  const sessionEarnings = (sessionSeconds / 60) * RATE_PER_MINUTE;

  const value = {
    isActive,
    sessionSeconds,
    setSessionSeconds,
    sessionEarnings,
    isHold,
    setIsHold,
    holdSeconds,
    setHoldSeconds,
    dailyTimeline,
    recordTimelineEvent,
    stats,
    updateStat,
    startSession,
    stopSession,
    endDay,
    RATE_PER_MINUTE,
    arsRate,
    setArsRate,
    isBreakActive,
    breakSeconds,
    setBreakSeconds,   // exposed for TimeEditModal
    startBreak,
    stopBreak,
    availSeconds,
    isEditingScoreboard,
    setIsEditingScoreboard,
    visibleCards,
    toggleCard,
    visibleMetrics,
    toggleMetric,
    scoreboardPreset,
    applyScoreboardPreset,
    isNotesOpen,
    setIsNotesOpen,
    isToolbarVisible,
    setIsToolbarVisible,
    workSessionMinutes,
    setWorkSessionStartTime,
    lastActivityTime,
    updateActivity,
    lastEnglishActivityTime,
    updateEnglishActivity,
    dailyLog,
    commitDayToLog,
    editPastDay,
    importCallLog,
    getMonthResyncPreview,
    reconcileMonthTotal,
    isZombieCall,
    clearZombieState,
    translationMood,
    setTranslationMood,
    speechAutoConnect,
    setSpeechAutoConnect,
    trySpeechAutoStart,
    callAutopilot,
    setCallAutopilot,
    callAutopilotRef,
    tryAutopilotStart,
    requestAutopilotEnd,
    cancelAutopilotEnd,
    consumeAutopilotEnd,
    autopilotEndsAt,
    autopilotEvent,
    armAutopilotFarewell,
    autopilotFarewellAt,
    notifySpeechDuringCall,
    lastSilenceDeductionMins,
    vaultStatus,
    adjustDailyMinutes,
    goalWorkDays,
    setGoalWorkDays,
    bankGoal, // ANCHORED-GOAL: writes goalMinutes + set-date/base/per-workday together
    isScoreboardHelpVisible,
    setIsScoreboardHelpVisible,
    isCallDetectionEnabled,
    setIsCallDetectionEnabled,
    autoAttachEnabled,
    setAutoAttachEnabled,
    callFocusMode,
    setCallFocusMode,
    lastCallSummary,
    setLastCallSummary,
    lastCallArchive,
    clearLastCallArchive,
    lastCallSeconds,
    lastCallEndedAt,
    requestHoldIntent,
    getCompensatedLogOff,
    minutesSinceLastBreak,
    historyTimeline,
    dailyGoal: (() => {
      const now = new Date();
      const year = now.getFullYear(), month = now.getMonth(), currentDay = now.getDate();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const remainingDays = daysInMonth - currentDay + 1;
      const minutesBeforeToday = Math.max(0, stats.monthlyMinutes - stats.dailyMinutes);
      const remainingMinutesFromStartOfDay = Math.max(0, stats.goalMinutes - minutesBeforeToday);
      const requiredDailyAverage = remainingDays > 0 ? (remainingMinutesFromStartOfDay / remainingDays) : 0;
      // Cap at 480m (8h) for realistic targets
      return Math.min(480, Math.max(250, requiredDailyAverage));
    })(),
    captions,
    updateCaptions,
    clearCaptions,
    isCaptionsLoaded,

    // HIPAA grace disconnect support
    hipaaGraceActive,
    hipaaGraceActiveRef,
    requestHipaaDisconnectGrace,
    cancelHipaaDisconnectGrace
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
