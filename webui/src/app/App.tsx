import "@material/web/icon/icon.js";
import "@material/web/ripple/ripple.js";
import { createElement, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { motion } from "motion/react";
import { MaterialFilledButton, MaterialIconButton, MaterialOutlinedButton } from "../components/MaterialButton";
import { type Locale, type MessageKey } from "../i18n/messages";
import { useI18n } from "../i18n/I18nProvider";
import { useConsoleTheme } from "../theme/ThemeProvider";
import { pageMotion, springs } from "../theme/motion";
import { shellStyles } from "./styles/shellStyles";
import { ConsoleAuthGate } from "./auth/ConsoleAuthGate";
import { useConsoleAuth } from "./auth/ConsoleAuthContext";

const navItems = [
  { to: "/overview", icon: "dashboard", labelKey: "nav.overview" },
  { to: "/models-providers", icon: "hub", labelKey: "nav.modelsProviders" },
  { to: "/routes", icon: "alt_route", labelKey: "nav.routes" },
  { to: "/defaults", icon: "rule_settings", labelKey: "nav.defaults" },
  { to: "/search-tools", icon: "travel_explore", labelKey: "nav.searchTools" },
  { to: "/storage", icon: "database", labelKey: "nav.storage" },
  { to: "/security", icon: "shield", labelKey: "nav.security" }
] as const;

type NavItem = (typeof navItems)[number];

export function App() {
  // shellStyles (incl. base tokens + .auth-card) is injected here — not in
  // AppShell — so the login card is fully styled even while the shell is
  // unmounted behind ConsoleAuthGate.
  return (
    <>
      <style>{shellStyles}</style>
      <ConsoleAuthGate>
        <AppShell content={<Outlet />} />
      </ConsoleAuthGate>
    </>
  );
}

export function AppShell({ content }: { content?: ReactNode }) {
  return <AppShellContent content={content} />;
}

function AppShellContent({ content }: { content?: ReactNode }) {
  const { theme, toggleTheme } = useConsoleTheme();
  const { locale, setLocale, t } = useI18n();
  const { signOut } = useConsoleAuth();
  const nextTheme = theme === "dark" ? "light" : "dark";
  const themeIcon = theme === "dark" ? "light_mode" : "dark_mode";
  const nextThemeLabel = t(nextTheme === "dark" ? "theme.dark" : "theme.light");

  return (
    <div className="app-shell">
      <header className="top-app-bar">
        <div>
          <p>Moon Bridge</p>
          <strong>{t("app.console")}</strong>
        </div>
        <div className="top-app-bar__meta">
          <div className="locale-switch" role="group" aria-label={t("app.language")}>
            <span>{t("app.language")}</span>
            {(["en-US", "zh-CN"] as const).map((nextLocale) => (
              <LocaleButton
                key={nextLocale}
                label={t(nextLocale === "en-US" ? "app.language.en" : "app.language.zh")}
                onClick={() => setLocale(nextLocale)}
                selected={locale === nextLocale}
              />
            ))}
          </div>
          <motion.div
            className="theme-toggle"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.9 }}
            transition={springs.spatialFast}
          >
            <motion.span
              key={themeIcon}
              style={{ display: "inline-flex" }}
              initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              transition={springs.spatial}
            >
              <MaterialIconButton
                icon={themeIcon}
                label={t("app.switchTheme", { theme: nextThemeLabel })}
                onClick={toggleTheme}
              />
            </motion.span>
          </motion.div>
          <MaterialIconButton
            className="app-bar__sign-out"
            icon="lock"
            label={t("app.signOut")}
            onClick={signOut}
          />
        </div>
      </header>

      <div className="workspace">
        <nav className="navigation-rail" aria-label={t("app.consoleSections")}>
          {navItems.map((item) => (
            <NavRailItem key={item.to} item={item} label={t(item.labelKey as MessageKey)} />
          ))}
        </nav>

        <motion.main
          aria-label={t("app.routeContent")}
          className="content-surface"
          initial={pageMotion.initial}
          animate={pageMotion.animate}
          transition={pageMotion.transition}
        >
          {content ?? <Outlet />}
        </motion.main>
      </div>
    </div>
  );
}

function LocaleButton({
  label,
  onClick,
  selected
}: {
  label: string;
  onClick: () => void;
  selected: boolean;
}) {
  if (selected) {
    return (
      <MaterialFilledButton ariaPressed={selected} className="locale-switch__button" onClick={onClick}>
        {label}
      </MaterialFilledButton>
    );
  }
  return (
    <MaterialOutlinedButton ariaPressed={selected} className="locale-switch__button" onClick={onClick}>
      {label}
    </MaterialOutlinedButton>
  );
}

function NavRailItem({ item, label }: { item: NavItem; label: string }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => (isActive ? "nav-item nav-item--active" : "nav-item")}
    >
      {({ isActive }) => (
        <>
          <span className="nav-item__icon">
            {isActive ? (
              <motion.span
                aria-hidden="true"
                className="nav-item__indicator"
                layoutId="nav-active-indicator"
                transition={springs.spatial}
              />
            ) : null}
            {createElement("md-icon", null, item.icon)}
            {createElement("md-ripple")}
          </span>
          <span className="nav-item__label">{label}</span>
        </>
      )}
    </NavLink>
  );
}
