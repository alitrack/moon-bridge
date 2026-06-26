import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithConsoleProviders } from "../test/renderWithConsoleProviders";
import { expectPanelElementToBeFlat, expectPanelRuleToAvoidEdges } from "../test/panelStyleAssertions";
import { AppShell } from "./App";

describe("AppShell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("shows the config graph navigation surface without staged apply", () => {
    renderWithConsoleProviders(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    );

    const labels = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(".navigation-rail a")
    ).map((link) => link.querySelector(".nav-item__label")?.textContent);

    expect(labels).toEqual([
      "Overview",
      "Models & Providers",
      "Routes",
      "Defaults",
      "Search & Tools",
      "Storage",
      "Security"
    ]);
    expect(document.querySelector(".navigation-rail")?.textContent).not.toContain("Config");
    expect(document.querySelector(".navigation-rail")?.textContent).not.toContain("RPC Test");
    expect(document.querySelector(".navigation-rail")?.textContent).not.toContain("Extensions");
    expect(screen.queryByRole("button", { name: /^apply$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /apply changes/i })).not.toBeInTheDocument();
  });

  test("keeps shell actions limited to locale and theme controls", () => {
    renderWithConsoleProviders(
      <MemoryRouter>
        <AppShell content={<div>Console content</div>} />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/language/i)).toBeInTheDocument();
    expect(getMaterialIconButton(document, "Switch to light theme")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
  });

  test("uses Material Web locale actions instead of a native browser select", () => {
    renderWithConsoleProviders(
      <MemoryRouter>
        <AppShell content={<div>Console content</div>} />
      </MemoryRouter>
    );

    expect(document.querySelector(".top-app-bar__meta select")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /language/i })).toBeInTheDocument();
    expect(getMaterialButton(document, "English", "filled")).toHaveAttribute("aria-pressed", "true");
    expect(getMaterialButton(document, "中文", "outlined")).toHaveAttribute("aria-pressed", "false");
  });

  test("keeps global filled button icon colors aligned with label colors", () => {
    renderWithConsoleProviders(
      <MemoryRouter>
        <AppShell content={<div>Console content</div>} />
      </MemoryRouter>
    );

    const selectedLocaleButton = getMaterialButton(document, "English", "filled");
    expectMaterialFilledButtonContentColors(selectedLocaleButton, "var(--mb-color-on-primary)");
  });

  test("changes locale through Material Web locale actions", () => {
    renderWithConsoleProviders(
      <MemoryRouter>
        <AppShell content={<div>Console content</div>} />
      </MemoryRouter>
    );

    fireEvent.click(getMaterialButton(document, "中文", "outlined"));

    expect(screen.getByRole("navigation", { name: "控制台分区" })).toBeInTheDocument();
    expect(getMaterialButton(document, "English", "outlined")).toHaveAttribute("aria-pressed", "false");
    expect(getMaterialButton(document, "中文", "filled")).toHaveAttribute("aria-pressed", "true");
  });

  test("changes theme through the Material Web icon button", () => {
    renderWithConsoleProviders(
      <MemoryRouter>
        <AppShell content={<div>Console content</div>} />
      </MemoryRouter>
    );

    const themeButton = getMaterialIconButton(document, "Switch to light theme");
    expect(themeButton.tagName.toLowerCase()).toBe("md-icon-button");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    fireEvent.click(themeButton);

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(getMaterialIconButton(document, "Switch to dark theme")).toBeInTheDocument();
  });

  test("keeps route content in a named main landmark with mobile-safe nav labels", () => {
    renderWithConsoleProviders(
      <MemoryRouter>
        <AppShell content={<div>Console content</div>} />
      </MemoryRouter>
    );

    expect(screen.getByRole("main", { name: "Console route content" })).toHaveTextContent("Console content");
    expect(screen.getByRole("link", { name: /models & providers/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /search & tools/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /console sections/i })).not.toHaveTextContent("YAML");
    expect(screen.getByRole("navigation", { name: /console sections/i })).not.toHaveTextContent("Diagnostics");
    expect(screen.getByRole("navigation", { name: /console sections/i })).not.toHaveTextContent("Logs");
  });

  test("gives shell background panels tonal surfaces without borders or glow", () => {
    renderWithConsoleProviders(
      <MemoryRouter>
        <AppShell
          content={(
            <>
              <section className="content-panel">Console content</section>
              <section className="placeholder-panel">Placeholder content</section>
            </>
          )}
        />
      </MemoryRouter>
    );

    const shellStyle = document.querySelector("style")?.textContent ?? "";
    const railRule = shellStyle.match(/\.navigation-rail \{[^}]+\}/)?.[0] ?? "";
    const rail = document.querySelector(".navigation-rail")!;
    const contentPanel = document.querySelector(".content-panel")!;
    const placeholderPanel = document.querySelector(".placeholder-panel")!;

    expect(railRule).toContain("background: var(--mb-color-surface-container-low)");
    expect(railRule).not.toContain("box-shadow");
    expect(railRule).not.toContain("background: transparent");
    for (const panel of [rail, contentPanel, placeholderPanel]) {
      expectPanelElementToBeFlat(panel);
    }
    expectPanelRuleToAvoidEdges(".navigation-rail");
    expectPanelRuleToAvoidEdges(".content-panel");
    expectPanelRuleToAvoidEdges(".placeholder-panel");
  });
});

function getMaterialButton(
  container: ParentNode,
  label: string,
  variant: "filled" | "outlined"
) {
  const tagName = variant === "filled" ? "md-filled-button" : "md-outlined-button";
  const element = Array.from(container.querySelectorAll(tagName)).find(
    (button) => button.textContent?.trim() === label
  );
  if (!element) {
    throw new Error(`Expected a Material Web ${variant} button labelled "${label}".`);
  }
  return element as HTMLElement;
}

function getMaterialIconButton(container: ParentNode, label: string) {
  const element = Array.from(container.querySelectorAll("md-icon-button")).find(
    (button) => button.getAttribute("aria-label") === label
  );
  if (!element) {
    throw new Error(`Expected a Material Web icon button labelled "${label}".`);
  }
  return element as HTMLElement;
}

function expectMaterialFilledButtonContentColors(button: HTMLElement, colorToken: string) {
  expect(button.tagName.toLowerCase()).toBe("md-filled-button");
  for (const property of [
    "--md-filled-button-label-text-color",
    "--md-filled-button-hover-label-text-color",
    "--md-filled-button-focus-label-text-color",
    "--md-filled-button-pressed-label-text-color",
    "--md-filled-button-icon-color",
    "--md-filled-button-hover-icon-color",
    "--md-filled-button-focus-icon-color",
    "--md-filled-button-pressed-icon-color"
  ]) {
    expect(getComputedStyle(button).getPropertyValue(property).trim()).toBe(colorToken);
  }
}
