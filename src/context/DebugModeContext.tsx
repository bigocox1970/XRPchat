import React, { createContext, useContext, useState } from 'react';

interface DebugModeContextType {
  debugMode: boolean;
  toggleDebugMode: () => void;
}

const DebugModeContext = createContext<DebugModeContextType | undefined>(undefined);

export const DebugModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [debugMode, setDebugMode] = useState(false);

  const toggleDebugMode = () => {
    setDebugMode(prev => !prev);
  };

  return (
    <DebugModeContext.Provider value={{ debugMode, toggleDebugMode }}>
      {children}
    </DebugModeContext.Provider>
  );
};

export const useDebugMode = () => {
  const context = useContext(DebugModeContext);
  if (context === undefined) {
    throw new Error('useDebugMode must be used within a DebugModeProvider');
  }
  return context;
};
