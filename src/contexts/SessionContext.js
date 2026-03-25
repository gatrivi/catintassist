import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Persistent stats
  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem('catintassist_stats');
    const today = new Date().toDateString();
    let initialStats = {
      dailyMinutes: 0,
      weeklyMinutes: 0,
      monthlyMinutes: 0,
      goalMinutes: 5500,
      lastDate: today
    };
    if (saved) {
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.lastDate !== today) {
          parsed.dailyMinutes = 0;
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
  const stateRef = useRef({ isActive, sessionSeconds, stats });
  
  useEffect(() => {
    stateRef.current = { isActive, sessionSeconds, stats };
  }, [isActive, sessionSeconds, stats]);

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
  }, [isActive, stats]);

  useEffect(() => {
    // 4. Background Tick Push for Timer
    const interval = setInterval(() => {
       if (stateRef.current.isActive) {
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

  const startSession = () => {
    setSessionSeconds(0);
    accumulatorRef.current = 0;
    setIsActive(true);
  };
  
  const stopSession = () => {
    setIsActive(false);
    // On stop, add elapsed time to persistent stats
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
        // Explicitly set localStorage to ensure it saves right away
        localStorage.setItem('catintassist_stats', JSON.stringify(newStats));
        return newStats;
      });
    }
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

  const updateStat = (key, value) => {
    setStats(prev => ({ ...prev, [key]: Number(value) }));
  };

  const sessionEarnings = (sessionSeconds / 60) * RATE_PER_MINUTE;

  const value = {
    isActive,
    sessionSeconds,
    sessionEarnings,
    stats,
    updateStat,
    startSession,
    stopSession,
    RATE_PER_MINUTE,
    arsRate,
    setArsRate
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
