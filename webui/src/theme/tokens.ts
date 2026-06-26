export type ConsoleTheme = "dark" | "light";

export const primarySeed = "#7AA7A2";

type ThemeTokens = Record<string, string>;

/**
 * Material Design 3 (Expressive) colour roles for the Moon Bridge console.
 *
 * Built from the teal primary seed (#7AA7A2) and extended with secondary
 * (muted teal), tertiary (cool blue), warning (warm amber) and success (green)
 * families so the UI can establish hierarchy through colour contrast — a core
 * M3 Expressive tactic. A full surface tonal scale (lowest → highest) supplies
 * expressive elevation without relying solely on shadows, which matters most in
 * the dark theme.
 */
export const themeTokens: Record<ConsoleTheme, ThemeTokens> = {
  dark: {
    // Primary — teal
    "--mb-color-primary": primarySeed,
    "--mb-color-on-primary": "#08201d",
    "--mb-color-primary-container": "#274e4a",
    "--mb-color-on-primary-container": "#d4f3ee",
    "--mb-color-primary-fixed": "#c3eae4",
    "--mb-color-primary-fixed-dim": "#a7cec8",
    // Secondary — desaturated teal
    "--mb-color-secondary": "#bbc8c5",
    "--mb-color-on-secondary": "#253331",
    "--mb-color-secondary-container": "#3b4947",
    "--mb-color-on-secondary-container": "#dbe5e2",
    // Tertiary — cool blue (accents + the "output" data series)
    "--mb-color-tertiary": "#a7c8e8",
    "--mb-color-on-tertiary": "#0c2438",
    "--mb-color-tertiary-container": "#3b4858",
    "--mb-color-on-tertiary-container": "#d8e4f8",
    // Warning — warm amber (restart-required / needs-attention)
    "--mb-color-warning": "#f3c06b",
    "--mb-color-on-warning": "#412d00",
    "--mb-color-warning-container": "#5b4300",
    "--mb-color-on-warning-container": "#ffdfa3",
    // Success — green (healthy / saved confirmations)
    "--mb-color-success": "#86d7a8",
    "--mb-color-on-success": "#003920",
    "--mb-color-success-container": "#1d5236",
    "--mb-color-on-success-container": "#a2f4c3",
    // Error
    "--mb-color-error": "#ffb4ab",
    "--mb-color-on-error": "#690005",
    "--mb-color-error-container": "#93000a",
    "--mb-color-on-error-container": "#ffdad6",
    // Surfaces — tonal elevation scale
    "--mb-color-surface": "#0e1413",
    "--mb-color-surface-dim": "#0e1413",
    "--mb-color-surface-bright": "#343b39",
    "--mb-color-surface-container-lowest": "#090f0e",
    "--mb-color-surface-container-low": "#161d1b",
    "--mb-color-surface-container": "#1a2120",
    "--mb-color-surface-container-high": "#252b2a",
    "--mb-color-surface-container-highest": "#2f3635",
    "--mb-color-on-surface": "#e0e3e1",
    "--mb-color-on-surface-variant": "#bec9c6",
    // Outline + utility
    "--mb-color-outline": "#899390",
    "--mb-color-outline-variant": "#3f4946",
    "--mb-color-shadow": "#000000",
    "--mb-color-scrim": "#000000",
    "--mb-color-inverse-surface": "#e0e3e1",
    "--mb-color-inverse-on-surface": "#2b3231",
    "--mb-color-inverse-primary": "#3a615c",
    "--mb-motion-standard": "180ms cubic-bezier(0.2, 0, 0, 1)"
  },
  light: {
    // Primary — teal
    "--mb-color-primary": "#406863",
    "--mb-color-on-primary": "#ffffff",
    "--mb-color-primary-container": "#c2ebe5",
    "--mb-color-on-primary-container": "#00201d",
    "--mb-color-primary-fixed": "#c2ebe5",
    "--mb-color-primary-fixed-dim": "#a6cfc9",
    // Secondary
    "--mb-color-secondary": "#4b6360",
    "--mb-color-on-secondary": "#ffffff",
    "--mb-color-secondary-container": "#cde8e3",
    "--mb-color-on-secondary-container": "#05201d",
    // Tertiary — cool blue
    "--mb-color-tertiary": "#41617d",
    "--mb-color-on-tertiary": "#ffffff",
    "--mb-color-tertiary-container": "#d4e4f7",
    "--mb-color-on-tertiary-container": "#101d2b",
    // Warning — warm amber
    "--mb-color-warning": "#7c5800",
    "--mb-color-on-warning": "#ffffff",
    "--mb-color-warning-container": "#ffdfa3",
    "--mb-color-on-warning-container": "#271900",
    // Success — green
    "--mb-color-success": "#236c47",
    "--mb-color-on-success": "#ffffff",
    "--mb-color-success-container": "#a8f4c5",
    "--mb-color-on-success-container": "#002111",
    // Error
    "--mb-color-error": "#ba1a1a",
    "--mb-color-on-error": "#ffffff",
    "--mb-color-error-container": "#ffdad6",
    "--mb-color-on-error-container": "#410002",
    // Surfaces — tonal elevation scale
    "--mb-color-surface": "#f4fbf8",
    "--mb-color-surface-dim": "#d5dbd8",
    "--mb-color-surface-bright": "#f4fbf8",
    "--mb-color-surface-container-lowest": "#ffffff",
    "--mb-color-surface-container-low": "#eef5f1",
    "--mb-color-surface-container": "#e8efeb",
    "--mb-color-surface-container-high": "#e2e9e6",
    "--mb-color-surface-container-highest": "#dde4e0",
    "--mb-color-on-surface": "#171d1b",
    "--mb-color-on-surface-variant": "#3f4946",
    // Outline + utility
    "--mb-color-outline": "#6f7976",
    "--mb-color-outline-variant": "#bec9c5",
    "--mb-color-shadow": "#000000",
    "--mb-color-scrim": "#000000",
    "--mb-color-inverse-surface": "#2b3231",
    "--mb-color-inverse-on-surface": "#eff1ee",
    "--mb-color-inverse-primary": "#a6cfc9",
    "--mb-motion-standard": "180ms cubic-bezier(0.2, 0, 0, 1)"
  }
};

export function applyThemeTokens(theme: ConsoleTheme, root: HTMLElement): void {
  Object.entries(themeTokens[theme]).forEach(([name, value]) => {
    root.style.setProperty(name, value);
    if (name.startsWith("--mb-color-")) {
      const mdSysName = name.replace("--mb-color-", "--md-sys-color-");
      root.style.setProperty(mdSysName, value);
    }
  });
}
