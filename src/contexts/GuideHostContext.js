import React, { createContext, useContext } from 'react';

const GuideHostContext = createContext({
  prepareGuideView: () => {},
});

export const GuideHostProvider = ({ children, prepareGuideView }) => (
  <GuideHostContext.Provider value={{ prepareGuideView: prepareGuideView || (() => {}) }}>
    {children}
  </GuideHostContext.Provider>
);

export const useGuideHost = () => useContext(GuideHostContext);
