import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useRewardAudio } from '../hooks/useRewardAudio';
import { set as idbSet, get as idbGet } from 'idb-keyval';

const PURGE_KEYS_PREFIX = 'trans_cache:';

const safeLocalStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.warn('[Storage] Quota exceeded, purging non-essential data...');
      // Emergency: clear all translation caches to make room for critical stats
      Object.keys(localStorage)
        .filter(k => k.startsWith(PURGE_KEYS_PREFIX))
        .forEach(k => localStorage.removeItem(k));
      
      // Try one last time
      try {
        localStorage.setItem(key, value);
      } catch (err) {
        console.error('[Storage] CRITICAL: Could not save after purge!', err);
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
  
  const [captions, setCaptions] = useState([]);
  const [isCaptionsLoaded, setIsCaptionsLoaded] = useState(false);

  const clearZombieState = () => {
    setIsZombieCall(false);
    safeLocalStorageSet('catint_active', 'false');
  };

  const [translationMood, setTranslationMood] = useState(() => localStorage.getItem('catint_trans_mood') || 'default');
  
  useEffect(() => {
    localStorage.setItem('catint_trans_mood', translationMood);
  }, [translationMood]);
  const [sessionSeconds, setSessionSeconds] = useState(() => Number(localStorage.getItem('catint_s_sec')) || 0);
  const [isBreakActive, setIsBreakActive] = useState(() => JSON.parse(localStorage.getItem('catint_break')) || false);
  const [breakSeconds, setBreakSeconds] = useState(() => Number(localStorage.getItem('catint_b_sec')) || 0);
  const [availSeconds, setAvailSeconds] = useState(() => Number(localStorage.getItem('catint_a_sec')) || 0);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
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
    const today = new Date().toDateString();
    let initialStats = {
      dailyMinutes: 0,
      dailyBreakMinutes: 0,
      dailyAvailMinutes: 0,
      weeklyMinutes: 0,
      monthlyMinutes: 0,
      goalMinutes: 5500,
      callsToday: 0,
      streak: 0,
      lastDate: today,
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
        if (saved && Array.isArray(saved)) {
          setCaptions(saved);
        }
      } catch (e) {
        console.warn('[Session] Failed to load captions:', e);
      } finally {
        setIsCaptionsLoaded(true);
      }
    };
    loadCaptions();
  }, []);

  const saveCaptionsTimeoutRef = useRef(null);
  const updateCaptions = useCallback((newCaptionsOrFn) => {
    setCaptions(prev => {
      const next = typeof newCaptionsOrFn === 'function' ? newCaptionsOrFn(prev) : newCaptionsOrFn;
      
      // Debounced save to IndexedDB
      if (saveCaptionsTimeoutRef.current) clearTimeout(saveCaptionsTimeoutRef.current);
      saveCaptionsTimeoutRef.current = setTimeout(async () => {
        try {
          await idbSet('catint_captions_v2', next);
        } catch (e) {
          console.error('[Session] Failed to save captions:', e);
        }
      }, 1000);
      
      return next;
    });
  }, []);

  const clearCaptions = useCallback(async () => {
    setCaptions([]);
    try {
      await idbSet('catint_captions_v2', []);
    } catch (e) {}
  }, []);

  useEffect(() => {
    safeLocalStorageSet('catintassist_stats', JSON.stringify(stats));
  }, [stats]);

  // CLOUD SYNC: Zero-auth syncing via ntfy.sh
  const [syncStatus, setSyncStatus] = useState('idle');
  const syncIdRef = useRef(null);

  useEffect(() => {
    const key = localStorage.getItem('DEEPGRAM_API_KEY');
    if (key && key.length > 10) {
      // Simple hash to create a unique topic
      let hash = 0;
      for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash) + key.charCodeAt(i);
      syncIdRef.current = `catint_sync_${Math.abs(hash).toString(36)}`;
    }
  }, []);

  const pushState = useCallback(async (forceStats = null) => {
    if (!syncIdRef.current) return;
    try {
      const payload = {
        stats: forceStats || stats,
        isActive,
        isBreakActive,
        lastUpdate: Date.now()
      };
      setSyncStatus('syncing');
      await fetch(`https://ntfy.sh/${syncIdRef.current}`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Title': 'App State Sync', 'Tags': 'gear' }
      });
      setSyncStatus('synced');
    } catch (e) {
      setSyncStatus('error');
    }
  }, [stats, isActive, isBreakActive]);

  // Pull state on mount or when API key is found
  useEffect(() => {
    if (!syncIdRef.current) return;
    const pull = async () => {
      try {
        const res = await fetch(`https://ntfy.sh/${syncIdRef.current}/json?poll=1&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
          const remote = JSON.parse(data[0].message);
          // Only hydrate if remote is newer and local is empty/smaller
          if (remote.stats && stats.dailyMinutes === 0) {
            setStats(prev => ({ ...prev, ...remote.stats }));
          }
        }
      } catch (e) {}
    };
    pull();
  }, [syncIdRef.current]); // eslint-disable-line

  // Periodic push
  useEffect(() => {
    const iv = setInterval(() => pushState(), 60000);
    return () => clearInterval(iv);
  }, [pushState]);

  const [holdIntentAt, setHoldIntentAt] = useState(0);

  const updateActivity = () => setLastActivityTime(Date.now());
  const requestHoldIntent = () => setHoldIntentAt(Date.now());

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
    const saved = localStorage.getItem('catint_toolbar_visible');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isHeatmapOpen, setIsHeatmapOpen] = useState(false);
  const [isScoreboardHelpVisible, setIsScoreboardHelpVisible] = useState(false);
  const [isCallDetectionEnabled, setIsCallDetectionEnabled] = useState(() => {
    const saved = localStorage.getItem('catint_call_detect');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => { localStorage.setItem('catint_notes_open', JSON.stringify(isNotesOpen)); }, [isNotesOpen]);
  useEffect(() => { localStorage.setItem('catint_toolbar_visible', JSON.stringify(isToolbarVisible)); }, [isToolbarVisible]);
  useEffect(() => { localStorage.setItem('catint_call_detect', JSON.stringify(isCallDetectionEnabled)); }, [isCallDetectionEnabled]);

  const [visibleCards, setVisibleCards] = useState(() => {
    const saved = localStorage.getItem('catintassist_visible_cards');
    return saved ? JSON.parse(saved) : { month: true, moneyMonth: true, today: true, moneyToday: true, call: true, break: true, avail: true, goal: true };
  });

  useEffect(() => {
    safeLocalStorageSet('catintassist_visible_cards', JSON.stringify(visibleCards));
  }, [visibleCards]);

  const toggleCard = (key) => setVisibleCards(v => ({ ...v, [key]: !v[key] }));

  // GUARDAMOS TODO: daily log tracks minutes per calendar day for the heatmap.
  const [dailyLog, setDailyLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem('catintassist_daily_log')) || {}; } catch(e) { return {}; }
  });
  useEffect(() => { safeLocalStorageSet('catintassist_daily_log', JSON.stringify(dailyLog)); }, [dailyLog]);

  // Write today's final minutes into dailyLog (called on endDay or midnight rollover)
  const commitDayToLog = useCallback((dateStr, minutes) => {
    setDailyLog(prev => ({ ...prev, [dateStr]: Math.round(minutes) }));
  }, []);


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
      .catch(err => console.error("Failed to fetch ARS rate:", err));
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
    updateActivity(); // <--- Reset silence timer on start
    
    // Logic fix: If a call starts while on break, automatically end the break.
    if (isBreakActive) {
      stopBreak();
    }
    
    commitAvailTime();
    
    if (!isRecovery) {
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
  
  // TERMINAR LLAMADA: Guardamos los minutos que trabajamos para no perderlos.
  const stopSession = (onCallEnded) => {
    setIsActive(false);
    const minutesToAdd = sessionSeconds / 60;
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
    setIsHold(false);
    // If we stop session, we default to 'avail' unless we immediately start a break
    recordTimelineEvent('avail');
  };

  // End of Day: commit daily total to log, check streak, reset counters
  const endDay = (onDayEnded) => {
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
        setIsBreakActive(false);
        const minutesToAdd = breakSeconds / 60;
        if (minutesToAdd > 0) {
          setStats(prev => {
            const newStats = { ...prev, dailyBreakMinutes: (prev.dailyBreakMinutes || 0) + minutesToAdd };
            safeLocalStorageSet('catintassist_stats', JSON.stringify(newStats));
            return newStats;
          });
        }
        setBreakSeconds(0);
      }
    }, 30000); // check every 30s is sufficient
    return () => clearInterval(midnightGuard);
  }, [isBreakActive, breakSeconds]);

  useEffect(() => {
    safeLocalStorageSet('catintassist_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSessionSeconds(prev => prev + 1);

        // SMART HOLD AUTO-TRIGGER
        // If a hold phrase was recently detected (<30s) and there's silence (>3s), auto-activate hold
        const silenceSecs = (Date.now() - lastActivityTime) / 1000;
        const wasHoldRequestedRecently = (Date.now() - holdIntentAt) < 30000;
        
        if (!isHold && wasHoldRequestedRecently && silenceSecs >= 3) {
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
    if (isActive) return;
    commitAvailTime();
    setBreakSeconds(0);
    setIsBreakActive(true);
    recordTimelineEvent('break');
  };
  
  const stopBreak = () => {
    updateActivity(); // <--- Reset silence timer when returning to work
    setIsBreakActive(false);
    recordTimelineEvent('avail');
    const minutesToAdd = breakSeconds / 60;
    const now = Date.now();
    setWorkSessionStartTime(now);
    if (minutesToAdd > 0) {
      setStats(prev => {
        const newStats = {
          ...prev,
          dailyBreakMinutes: (prev.dailyBreakMinutes || 0) + minutesToAdd,
          lastBreakEndTime: now
        };
        safeLocalStorageSet('catintassist_stats', JSON.stringify(newStats));
        return newStats;
      });
    }
  };

  const updateStat = (key, value) => {
    setStats(prev => ({ ...prev, [key]: Number(value) }));
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
    isNotesOpen,
    setIsNotesOpen,
    isToolbarVisible,
    setIsToolbarVisible,
    workSessionMinutes,
    setWorkSessionStartTime,
    lastActivityTime,
    updateActivity,
    dailyLog,
    commitDayToLog,
    isZombieCall,
    clearZombieState,
    translationMood,
    setTranslationMood,
    isHeatmapOpen,
    setIsHeatmapOpen,
    isScoreboardHelpVisible,
    setIsScoreboardHelpVisible,
    isCallDetectionEnabled,
    setIsCallDetectionEnabled,
    requestHoldIntent,
    getCompensatedLogOff,
    minutesSinceLastBreak,
    historyTimeline,
    syncStatus,
    pushState,
    dailyGoal: (() => {
      const now = new Date();
      const year = now.getFullYear(), month = now.getMonth(), currentDay = now.getDate();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const remainingDays = daysInMonth - currentDay + 1;
      const minutesBeforeToday = Math.max(0, stats.monthlyMinutes - stats.dailyMinutes);
      const remainingMinutesFromStartOfDay = Math.max(0, stats.goalMinutes - minutesBeforeToday);
      const requiredDailyAverage = remainingDays > 0 ? (remainingMinutesFromStartOfDay / remainingDays) : 0;
      // Industry best practice: cap "Catch-up" targets at 600m (10h) to avoid burnout/impossibility
    })(),
    captions,
    updateCaptions,
    clearCaptions,
    isCaptionsLoaded
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
