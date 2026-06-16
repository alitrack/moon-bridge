import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { applyThemeTokens, type ConsoleTheme } from "./tokens";

export const CONSOLE_THEME_STORAGE_KEY = "moonbridge.console.theme";

type ConsoleThemeContextValue = {
  theme: ConsoleTheme;
  setTheme: (theme: ConsoleTheme) => void;
  toggleTheme: () => void;
};

const ConsoleThemeContext = createContext<ConsoleThemeContextValue | undefined>(
  undefined
);

function readStoredTheme(): ConsoleTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  try {
    if (!window.localStorage) {
      return "dark";
    }
    const stored = window.localStorage.getItem(CONSOLE_THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "dark";
  } catch {
    return "dark";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ConsoleTheme>(readStoredTheme);

  const setTheme = useCallback((nextTheme: ConsoleTheme) => {
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    applyThemeTokens(theme, root);
    try {
      window.localStorage?.setItem(CONSOLE_THEME_STORAGE_KEY, theme);
    } catch {
      // Storage may be disabled in hardened browser contexts.
    }
  }, [theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <ConsoleThemeContext.Provider value={value}>
      {children}
    </ConsoleThemeContext.Provider>
  );
}

export function useConsoleTheme(): ConsoleThemeContextValue {
  const context = useContext(ConsoleThemeContext);
  if (!context) {
    throw new Error("useConsoleTheme must be used within ThemeProvider");
  }
  return context;
}
