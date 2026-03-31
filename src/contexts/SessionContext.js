import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
  const [isActive, setIsActive] = useState(() => JSON.parse(localStorage.getItem('catint_active')) || false);
  const [sessionSeconds, setSessionSeconds] = useState(() => Number(localStorage.getItem('catint_s_sec')) || 0);
  const [isBreakActive, setIsBreakActive] = useState(() => JSON.parse(localStorage.getItem('catint_break')) || false);
  const [breakSeconds, setBreakSeconds] = useState(() => Number(localStorage.getItem('catint_b_sec')) || 0);
  const [availSeconds, setAvailSeconds] = useState(() => Number(localStorage.getItem('catint_a_sec')) || 0);

  useEffect(() => { localStorage.setItem('catint_active', JSON.stringify(isActive)); }, [isActive]);
  useEffect(() => { localStorage.setItem('catint_s_sec', sessionSeconds); }, [sessionSeconds]);
  useEffect(() => { localStorage.setItem('catint_break', JSON.stringify(isBreakActive)); }, [isBreakActive]);
  useEffect(() => { localStorage.setItem('catint_b_sec', breakSeconds); }, [breakSeconds]);
  useEffect(() => { localStorage.setItem('catint_a_sec', availSeconds); }, [availSeconds]);

  // Scoreboard Customization State
  const [isEditingScoreboard, setIsEditingScoreboard] = useState(false);
  const [visibleCards, setVisibleCards] = useState(() => {
    try {
      const saved = localStorage.getItem('catintassist_visible_cards');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return { controls: true, month: true, today: true, call: true, break: true, avail: true, goal: true, transcription: true };
  });

  useEffect(() => {
    localStorage.setItem('catintassist_visible_cards', JSON.stringify(visibleCards));
  }, [visibleCards]);

  const toggleCard = (key) => setVisibleCards(v => ({ ...v, [key]: !v[key] }));

  // Persistent stats
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
      lastDate: today
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.lastDate !== today) {
          parsed.dailyMinutes = 0;
          parsed.dailyBreakMinutes = 0;
          parsed.dailyAvailMinutes = 0;
          parsed.lastDate = today;
        }
        initialStats = { ...initialStats, ...parsed };
      } catch(e) {}
    }
    return initialStats;
  });

  const [arsRate, setArsRate] = useState(1050);

  // ----- CLOUD SYNC LOGIC (ntfy.sh zero-auth) -----
  const lastSyncHashRef = useRef('');
  const stateRef = useRef({ isActive, sessionSeconds, stats, isBreakActive, breakSeconds, availSeconds });
  
  useEffect(() => {
    stateRef.current = { isActive, sessionSeconds, stats, isBreakActive, breakSeconds, availSeconds };
  }, [isActive, sessionSeconds, stats, isBreakActive, breakSeconds, availSeconds]);

  useEffect(() => {
    const topic = 'catintassist_v1_syncroom';
    
    // 1. Initial Pull
    fetch(`https://ntfy.sh/${topic}/json?poll=1`)
      .then(res => res.text())
      .then(text => {
         const lines = text.trim().split('\n');
         const lastLine = lines[lines.length - 1];
         if (lastLine) {
           const data = JSON.parse(lastLine);
           if (data.event === 'message') {
             const payload = data.message;
             lastSyncHashRef.current = payload;
             const remoteState = JSON.parse(payload);
             setIsActive(remoteState.isActive);
             setSessionSeconds(remoteState.sessionSeconds);
             if (remoteState.isBreakActive !== undefined) setIsBreakActive(remoteState.isBreakActive);
             if (remoteState.breakSeconds !== undefined) setBreakSeconds(remoteState.breakSeconds);
             if (remoteState.availSeconds !== undefined) setAvailSeconds(remoteState.availSeconds);
             if (remoteState.stats && remoteState.stats.lastDate) setStats(remoteState.stats);
           }
         }
      }).catch(() => {});

    // 2. Realtime Subscription
    const es = new EventSource(`https://ntfy.sh/${topic}/sse`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'message') {
          const payload = data.message;
          if (payload === lastSyncHashRef.current) return; // ignore our own
          lastSyncHashRef.current = payload;
          const remoteState = JSON.parse(payload);
          setIsActive(remoteState.isActive);
          setSessionSeconds(remoteState.sessionSeconds);
          if (remoteState.isBreakActive !== undefined) setIsBreakActive(remoteState.isBreakActive);
          if (remoteState.breakSeconds !== undefined) setBreakSeconds(remoteState.breakSeconds);
          if (remoteState.availSeconds !== undefined) setAvailSeconds(remoteState.availSeconds);
          if (remoteState.stats && remoteState.stats.lastDate) {
            setStats(prev => JSON.stringify(prev) === JSON.stringify(remoteState.stats) ? prev : remoteState.stats);
          }
        }
      } catch (err) {}
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    // 3. Instant Push on Major Events (Start/Stop/Edit)
    const payload = JSON.stringify(stateRef.current);
    if (payload !== lastSyncHashRef.current) {
      lastSyncHashRef.current = payload;
      fetch(`https://ntfy.sh/catintassist_v1_syncroom`, { method: 'POST', body: payload }).catch(()=>{});
    }
  }, [isActive, stats, isBreakActive]);

  useEffect(() => {
    // 4. Background Tick Push for Timer
    const interval = setInterval(() => {
       if (stateRef.current.isActive || stateRef.current.isBreakActive) {
         const payload = JSON.stringify(stateRef.current);
         if (payload !== lastSyncHashRef.current) {
            lastSyncHashRef.current = payload;
            fetch(`https://ntfy.sh/catintassist_v1_syncroom`, { method: 'POST', body: payload }).catch(()=>{});
         }
       }
    }, 5000);
    return () => clearInterval(interval);
  }, []);
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

  const startSession = () => {
    commitAvailTime();
    setSessionSeconds(0);
    accumulatorRef.current = 0;
    setIsActive(true);
  };
  
  const stopSession = (onCallEnded) => {
    setIsActive(false);
    const minutesToAdd = sessionSeconds / 60;
    if (minutesToAdd > 0) {
      setStats(prev => {
        const today = new Date().toDateString();
        const isNewDay = prev.lastDate && prev.lastDate !== today;
        const newStats = {
          ...prev,
          dailyMinutes: (isNewDay ? 0 : (prev.dailyMinutes || 0)) + minutesToAdd,
          weeklyMinutes: (prev.weeklyMinutes || 0) + minutesToAdd,
          monthlyMinutes: (prev.monthlyMinutes || 0) + minutesToAdd,
          lastDate: today
        };
        localStorage.setItem('catintassist_stats', JSON.stringify(newStats));
        return newStats;
      });
      if (onCallEnded) onCallEnded(minutesToAdd);
    }
  };

  // End of Day: commit daily total to monthly (called explicitly or auto on new day)
  const endDay = (onDayEnded) => {
    commitAvailTime();
    setStats(prev => {
      const newStats = { ...prev, dailyMinutes: 0, dailyBreakMinutes: 0, dailyAvailMinutes: 0, lastDate: new Date().toDateString() };
      localStorage.setItem('catintassist_stats', JSON.stringify(newStats));
      if (onDayEnded) onDayEnded(prev.dailyMinutes);
      return newStats;
    });
  };

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
    if (!isActive && !isBreakActive) {
      availTimerRef.current = setInterval(() => {
        setAvailSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (availTimerRef.current) clearInterval(availTimerRef.current);
    }
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
    setIsBreakActive(false);
    const minutesToAdd = breakSeconds / 60;
    if (minutesToAdd > 0) {
      setStats(prev => {
        const newStats = {
          ...prev,
          dailyBreakMinutes: (prev.dailyBreakMinutes || 0) + minutesToAdd
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
    startBreak,
    stopBreak,
    availSeconds,
    isEditingScoreboard,
    setIsEditingScoreboard,
    visibleCards,
    toggleCard
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
