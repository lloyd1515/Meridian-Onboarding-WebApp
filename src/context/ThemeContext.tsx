import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeType =
  | 'meridian-light'
  | 'meridian-slate-dark'
  | 'meridian-obsidian-dark'
  | 'meridian-teal-dark'
  | 'meridian-steel-dark'
  | 'meridian-bronze-dark';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    const saved = localStorage.getItem('meridian_theme');
    return (saved as ThemeType) || 'meridian-light';
  });

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('meridian_theme', newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(
      'theme-meridian-light',
      'theme-meridian-slate-dark',
      'theme-meridian-obsidian-dark',
      'theme-meridian-teal-dark',
      'theme-meridian-steel-dark',
      'theme-meridian-bronze-dark'
    );
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
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
