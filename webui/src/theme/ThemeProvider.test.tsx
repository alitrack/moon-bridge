import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONSOLE_THEME_STORAGE_KEY,
  ThemeProvider,
  useConsoleTheme
} from "./ThemeProvider";

function ThemeProbe() {
  const { theme, setTheme, toggleTheme } = useConsoleTheme();

  return (
    <section>
      <p data-testid="theme-value">{theme}</p>
      <button type="button" onClick={() => setTheme("light")}>
        Set light
      </button>
      <button type="button" onClick={toggleTheme}>
        Toggle
      </button>
    </section>
  );
}

describe("ThemeProvider", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("style");
  });

  it("defaults to the dark theme", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("switches to light theme", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await user.click(screen.getByRole("button", { name: "Set light" }));

    expect(screen.getByTestId("theme-value")).toHaveTextContent("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("applies container tokens used by expressive resource cards", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(document.documentElement.style.getPropertyValue("--mb-color-secondary-container")).not.toBe("");
    expect(document.documentElement.style.getPropertyValue("--mb-color-on-secondary-container")).not.toBe("");
    expect(document.documentElement.style.getPropertyValue("--mb-color-tertiary-container")).not.toBe("");
    expect(document.documentElement.style.getPropertyValue("--mb-color-on-tertiary-container")).not.toBe("");
    expect(document.documentElement.style.getPropertyValue("--mb-color-error-container")).not.toBe("");
    expect(document.documentElement.style.getPropertyValue("--mb-color-on-error-container")).not.toBe("");
  });

  it("persists the selected theme in localStorage", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await user.click(screen.getByRole("button", { name: "Toggle" }));

    expect(localStorage.getItem(CONSOLE_THEME_STORAGE_KEY)).toBe("light");
  });

  it("falls back to dark when localStorage is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      }
    });

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");

    if (original) {
      Object.defineProperty(window, "localStorage", original);
    }
  });
});
