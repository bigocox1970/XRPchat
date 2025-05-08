import React, { createContext, useContext, useState, useEffect } from 'react';
import { HiMoon, HiSun } from 'react-icons/hi';
import { FaPalette } from 'react-icons/fa';

export type ThemeType = 'default-light' | 'default-dark' | 'natural-light' | 'natural-dark';

interface ThemeContextType {
  currentTheme: ThemeType;
  isDarkMode: boolean;
  isNaturalTheme: boolean;
  toggleDarkMode: () => void;
  toggleThemeStyle: () => void;
  ThemeToggle: React.FC;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'xrpchat_theme_preference';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state from localStorage or default to 'default-dark'
  const [currentTheme, setCurrentTheme] = useState<ThemeType>(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return (savedTheme as ThemeType) || 'default-dark';
  });

  // Derived states
  const isDarkMode = currentTheme.includes('dark');
  const isNaturalTheme = currentTheme.includes('natural');

  // Apply theme classes and save to localStorage when theme changes
  useEffect(() => {
    // Apply theme classes to html element
    document.documentElement.classList.remove('default-light', 'default-dark', 'natural-light', 'natural-dark');
    document.documentElement.classList.add(currentTheme);
    
    // Keep the dark class for backward compatibility with existing styles
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Save current theme to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  }, [currentTheme, isDarkMode]);

  const toggleDarkMode = () => {
    setCurrentTheme(prev => {
      const newTheme = prev === 'default-light' ? 'default-dark' :
                      prev === 'default-dark' ? 'default-light' :
                      prev === 'natural-light' ? 'natural-dark' : 'natural-light';
      return newTheme;
    });
  };

  const toggleThemeStyle = () => {
    setCurrentTheme(prev => {
      const newTheme = prev === 'default-light' ? 'natural-light' :
                      prev === 'default-dark' ? 'natural-dark' :
                      prev === 'natural-light' ? 'default-light' : 'default-dark';
      return newTheme;
    });
  };

  const ThemeToggle: React.FC = () => (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleDarkMode}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDarkMode ? (
          <HiSun className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        ) : (
          <HiMoon className="w-5 h-5 text-gray-500" />
        )}
      </button>
      <button
        onClick={toggleThemeStyle}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label={isNaturalTheme ? 'Switch to default theme' : 'Switch to natural theme'}
        title={isNaturalTheme ? 'Switch to default theme' : 'Switch to natural theme'}
      >
        <FaPalette className={`w-5 h-5 ${isNaturalTheme ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`} />
      </button>
    </div>
  );

  return (
    <ThemeContext.Provider value={{ 
      currentTheme, 
      isDarkMode, 
      isNaturalTheme,
      toggleDarkMode, 
      toggleThemeStyle, 
      ThemeToggle 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// For backward compatibility
export const DarkModeProvider = ThemeProvider;
export const useDarkMode = useTheme;
