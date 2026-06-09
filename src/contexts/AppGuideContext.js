import React, { createContext, useContext, useState, useCallback } from 'react';
import { AppGuideOverlay } from '../components/AppGuide';

const AppGuideContext = createContext(null);

export const AppGuideProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const closeCallbackRef = React.useRef(null);

  const openGuide = useCallback((onClose) => {
    closeCallbackRef.current = typeof onClose === 'function' ? onClose : null;
    setOpen(true);
  }, []);

  const closeGuide = useCallback(() => {
    setOpen(false);
    const cb = closeCallbackRef.current;
    closeCallbackRef.current = null;
    if (cb) cb();
  }, []);

  return (
    <AppGuideContext.Provider value={{ openGuide, closeGuide, isGuideOpen: open }}>
      {children}
      {open && <AppGuideOverlay onClose={closeGuide} />}
    </AppGuideContext.Provider>
  );
};

export const useAppGuide = () => {
  const ctx = useContext(AppGuideContext);
  if (!ctx) throw new Error('useAppGuide requires AppGuideProvider');
  return ctx;
};
