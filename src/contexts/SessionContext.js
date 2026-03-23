import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Persistent stats
  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem('catintassist_stats');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      dailyMinutes: 0,
      weeklyMinutes: 0,
      monthlyMinutes: 0,
      goalMinutes: 5500
    };
  });

  const [arsRate, setArsRate] = useState(1050);

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
        const newStats = {
          ...prev,
          dailyMinutes: prev.dailyMinutes + minutesToAdd,
          weeklyMinutes: prev.weeklyMinutes + minutesToAdd,
          monthlyMinutes: prev.monthlyMinutes + minutesToAdd
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
