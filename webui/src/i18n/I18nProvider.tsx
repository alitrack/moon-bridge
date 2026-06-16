import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";
import { type Locale, type MessageKey, messages, normalizeLocale } from "./messages";

export const CONSOLE_LOCALE_STORAGE_KEY = "moonbridge.console.locale";

type InterpolationValue = string | number;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: Record<string, InterpolationValue>) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(readInitialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    safeSetStorage(CONSOLE_LOCALE_STORAGE_KEY, nextLocale);
  }, []);

  const t = useCallback(
    (key: MessageKey, values?: Record<string, InterpolationValue>) =>
      translateMessageForLocale(locale, key, values),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export function translateMessage(key: MessageKey, values?: Record<string, InterpolationValue>) {
  return translateMessageForLocale(readInitialLocale(), key, values);
}

function translateMessageForLocale(
  locale: Locale,
  key: MessageKey,
  values?: Record<string, InterpolationValue>
) {
  return interpolate(messages[locale][key] ?? messages["zh-CN"][key], values);
}

function readInitialLocale(): Locale {
  const stored = safeGetStorage(CONSOLE_LOCALE_STORAGE_KEY);
  if (stored === "en-US" || stored === "zh-CN") {
    return stored;
  }
  if (typeof window === "undefined") {
    return "zh-CN";
  }
  return normalizeLocale(window.navigator.language);
}

function interpolate(message: string, values?: Record<string, InterpolationValue>) {
  if (!values) {
    return message;
  }
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    message
  );
}

function safeGetStorage(key: string): string | null {
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Storage can be disabled in hardened browser contexts.
  }
}
