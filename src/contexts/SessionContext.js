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

  const RATE_PER_MINUTE = 0.13;
  const timerRef = useRef(null);
  const accumulatorRef = useRef(0); // collects fractional seconds

  const startSession = () => setIsActive(true);
  const stopSession = () => setIsActive(false);

  useEffect(() => {
    localStorage.setItem('catintassist_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSessionSeconds(prev => prev + 1);
        
        accumulatorRef.current += 1;
        if (accumulatorRef.current >= 60) {
          // A full minute has passed, add to persistent stats
          setStats(prev => ({
            ...prev,
            dailyMinutes: prev.dailyMinutes + 1,
            weeklyMinutes: prev.weeklyMinutes + 1,
            monthlyMinutes: prev.monthlyMinutes + 1
          }));
          accumulatorRef.current -= 60;
        }
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
    RATE_PER_MINUTE
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
