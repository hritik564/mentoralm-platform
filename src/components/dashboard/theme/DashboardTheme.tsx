'use client';
import { createContext, useContext, useState } from 'react';
import {
  dashboardThemeCookie,
  type DashboardTheme as Theme,
} from '../../../lib/dashboard/theme';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
});
export function DashboardTheme({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState(initialTheme);
  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    document.cookie = `${dashboardThemeCookie}=${next}; Path=/dashboard; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    setTheme(next);
  }
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useDashboardTheme() {
  return useContext(ThemeContext);
}
export function DashboardThemeToggle() {
  const { theme, toggle } = useDashboardTheme();
  return (
    <button
      type="button"
      className="dashboard-theme-toggle"
      aria-label="Dark mode"
      aria-pressed={theme === 'dark'}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      onClick={toggle}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        {theme === 'dark' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        ) : (
          <path d="M20.8 14A9 9 0 0 1 10 3.2 9 9 0 1 0 20.8 14Z" />
        )}
      </svg>
    </button>
  );
}
