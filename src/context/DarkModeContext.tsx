import React, { createContext, useContext, useState, useEffect } from 'react';
import { HiMoon, HiSun } from 'react-icons/hi';

interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  DarkModeToggle: React.FC;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

export const DarkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode

  useEffect(() => {
    // Apply dark mode class to html element
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const DarkModeToggle: React.FC = () => (
    <button
      onClick={toggleDarkMode}
      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDarkMode ? (
        <HiSun className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      ) : (
        <HiMoon className="w-5 h-5 text-gray-500" />
      )}
    </button>
  );

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode, DarkModeToggle }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
};
