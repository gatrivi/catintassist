import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
  const [isActive, setIsActive] = useState(() => JSON.parse(localStorage.getItem('catint_active')) || false);
  const [sessionSeconds, setSessionSeconds] = useState(() => Number(localStorage.getItem('catint_s_sec')) || 0);
  const [isBreakActive, setIsBreakActive] = useState(() => JSON.parse(localStorage.getItem('catint_break')) || false);
  const [breakSeconds, setBreakSeconds] = useState(() => Number(localStorage.getItem('catint_b_sec')) || 0);
  const [availSeconds, setAvailSeconds] = useState(() => Number(localStorage.getItem('catint_a_sec')) || 0);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());

  const updateActivity = () => setLastActivityTime(Date.now());

  useEffect(() => { localStorage.setItem('catint_active', JSON.stringify(isActive)); }, [isActive]);
  useEffect(() => { localStorage.setItem('catint_s_sec', sessionSeconds); }, [sessionSeconds]);
  useEffect(() => { localStorage.setItem('catint_break', JSON.stringify(isBreakActive)); }, [isBreakActive]);
  useEffect(() => { localStorage.setItem('catint_b_sec', breakSeconds); }, [breakSeconds]);
  useEffect(() => { localStorage.setItem('catint_a_sec', availSeconds); }, [availSeconds]);

  const [isEditingScoreboard, setIsEditingScoreboard] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(() => JSON.parse(localStorage.getItem('catint_notes_open')) || false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(() => {
    const saved = localStorage.getItem('catint_toolbar_visible');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => { localStorage.setItem('catint_notes_open', JSON.stringify(isNotesOpen)); }, [isNotesOpen]);
  useEffect(() => { localStorage.setItem('catint_toolbar_visible', JSON.stringify(isToolbarVisible)); }, [isToolbarVisible]);

  const [visibleCards, setVisibleCards] = useState(() => {
    const saved = localStorage.getItem('catintassist_visible_cards');
    return saved ? JSON.parse(saved) : { month: true, moneyMonth: true, today: true, moneyToday: true, call: true, break: true, avail: true, goal: true };
  });

  useEffect(() => {
    localStorage.setItem('catintassist_visible_cards', JSON.stringify(visibleCards));
  }, [visibleCards]);

  const toggleCard = (key) => setVisibleCards(v => ({ ...v, [key]: !v[key] }));

  // GUARDAMOS TODO: daily log tracks minutes per calendar day for the heatmap.
  const [dailyLog, setDailyLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem('catintassist_daily_log')) || {}; } catch(e) { return {}; }
  });
  useEffect(() => { localStorage.setItem('catintassist_daily_log', JSON.stringify(dailyLog)); }, [dailyLog]);

  // Write today's final minutes into dailyLog (called on endDay or midnight rollover)
  const commitDayToLog = useCallback((dateStr, minutes) => {
    setDailyLog(prev => ({ ...prev, [dateStr]: Math.round(minutes) }));
  }, []);

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
      dayStartTime: null
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.lastDate && parsed.lastDate !== today) {
          // Midnight rollover: write previous day's minutes into log
          const prevLog = JSON.parse(localStorage.getItem('catintassist_daily_log')) || {};
          if (parsed.dailyMinutes > 0) {
            prevLog[parsed.lastDate] = Math.round(parsed.dailyMinutes);
            localStorage.setItem('catintassist_daily_log', JSON.stringify(prevLog));
          }
          parsed.dailyMinutes = 0;
          parsed.dailyBreakMinutes = 0;
          parsed.dailyAvailMinutes = 0;
          parsed.callsToday = 0;
          parsed.dayStartTime = null;
          parsed.lastBreakEndTime = null;
          parsed.lastDate = today;
        }
        initialStats = { ...initialStats, ...parsed };
      } catch(e) {}
    }
    return initialStats;
  });

  // HEATMAP OPEN STATE
  const [isHeatmapOpen, setIsHeatmapOpen] = useState(false);

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
          localStorage.setItem('catintassist_stats', JSON.stringify(newStats));
          return newStats;
        });
      }
      return 0;
    });
  };

  // EMPEZAR LLAMADA: Dejamos de descansar y empezamos a contar los minutos de la llamada.
  const startSession = () => {
    updateActivity(); // <--- Reset silence timer on start
    commitAvailTime();
    setSessionSeconds(0);
    accumulatorRef.current = 0;
    setIsActive(true);
    
    // Catch-up logic: record the very first time we start working today
    setStats(prev => {
      const now = Date.now();
      if (!prev.dayStartTime) {
        setWorkSessionStartTime(now);
        return { ...prev, dayStartTime: now };
      }
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
        localStorage.setItem('catintassist_stats', JSON.stringify(newStats));
        return newStats;
      });
      if (onCallEnded) onCallEnded(minutesToAdd);
    }
  };

  // End of Day: commit daily total to log, check streak, reset counters
  const endDay = (onDayEnded) => {
    commitAvailTime();
    setStats(prev => {
      // Write today into daily log before zeroing
      const todayStr = prev.lastDate || new Date().toDateString();
      commitDayToLog(todayStr, prev.dailyMinutes);

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
      localStorage.setItem('catintassist_stats', JSON.stringify(newStats));
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
            localStorage.setItem('catintassist_stats', JSON.stringify(newStats));
            return newStats;
          });
        }
        setBreakSeconds(0);
      }
    }, 30000); // check every 30s is sufficient
    return () => clearInterval(midnightGuard);
  }, [isBreakActive, breakSeconds]);

  useEffect(() => {
    localStorage.setItem('catintassist_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSessionSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

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
  };
  
  const stopBreak = () => {
    updateActivity(); // <--- Reset silence timer when returning to work
    setIsBreakActive(false);
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
        localStorage.setItem('catintassist_stats', JSON.stringify(newStats));
        return newStats;
      });
    }
  };

  const updateStat = (key, value) => {
    setStats(prev => ({ ...prev, [key]: Number(value) }));
  };

  const sessionEarnings = (sessionSeconds / 60) * RATE_PER_MINUTE;

  const value = {
    isActive,
    sessionSeconds,
    setSessionSeconds,
    sessionEarnings,
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
    isHeatmapOpen,
    setIsHeatmapOpen
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
