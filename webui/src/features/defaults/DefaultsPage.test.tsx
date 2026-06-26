import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { renderWithConsoleProviders } from "../../test/renderWithConsoleProviders";
import * as configGraph from "../../rpc/configGraph";
import { configGraphFixture } from "../../test/configGraphFixtures";
import { DefaultsPage } from "./DefaultsPage";

describe("DefaultsPage", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("renders defaults, trace, and log resources", async () => {
    vi.spyOn(configGraph, "getConfigGraph").mockResolvedValue(configGraphFixture());

    renderWithConsoleProviders(<DefaultsPage />);

    expect(await screen.findByRole("heading", { level: 2, name: "Defaults" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Trace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Log" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Defaults main status")).getByText("Saved")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Trace main status")).getByText("Saved")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Log main status")).getByText("Saved")).toBeInTheDocument();
    expect(screen.getAllByText("Hot reload").length).toBeGreaterThan(0);
    const defaultModelField = getMaterialTextField(document, "Default model");
    expect(defaultModelField.value).toBe("claude-sonnet");
    expectLobeLeadingIcon(defaultModelField);
    expect(getMaterialSelect(document, "Log level").value).toBe("info");
  });

  test("resolves default model route aliases to their underlying model icon", async () => {
    const graph = configGraphFixture();
    const defaults = graph.resources.find((resource) => resource.kind === "defaults");
    if (!defaults) {
      throw new Error("Fixture is missing defaults resource.");
    }
    defaults.value = { ...defaults.value, model: "primary" };
    vi.spyOn(configGraph, "getConfigGraph").mockResolvedValue(graph);

    renderWithConsoleProviders(<DefaultsPage />);

    const defaultModelField = await findMaterialTextField(document, "Default model");
    expect(defaultModelField.value).toBe("primary");
    expectLobeLeadingIcon(defaultModelField, "Claude");
  });

  test("autosaves defaults through graph patches", async () => {
    vi.spyOn(configGraph, "getConfigGraph").mockResolvedValue(configGraphFixture());
    const patch = vi.spyOn(configGraph, "patchConfigGraph").mockResolvedValue({
      result: "committed",
      revision: "rev-2"
    });

    renderWithConsoleProviders(<DefaultsPage />);

    const defaultsPanel = (await screen.findByRole("heading", { level: 2, name: "Defaults" }))
      .closest("section")!;
    vi.useFakeTimers();
    const modelField = getMaterialTextField(defaultsPanel, "Default model");
    setMaterialTextFieldValue(modelField, "gpt-4o");
    fireEvent.blur(modelField);

    await advanceAutosave();

    expect(patch).toHaveBeenCalledWith({
      baseRevision: "rev-1",
      changes: [
        {
          kind: "defaults",
          id: "main",
          field: "model",
          value: "gpt-4o"
        }
      ]
    });
  });

  test("does not expose delete actions for singleton default resources", async () => {
    vi.spyOn(configGraph, "getConfigGraph").mockResolvedValue(configGraphFixture());

    renderWithConsoleProviders(<DefaultsPage />);

    expect(await screen.findByRole("heading", { level: 2, name: "Defaults" })).toBeInTheDocument();
    expect(queryMaterialFilledButton(document, "Delete Defaults main")).not.toBeInTheDocument();
    expect(queryMaterialFilledButton(document, "Delete Trace main")).not.toBeInTheDocument();
    expect(queryMaterialFilledButton(document, "Delete Log main")).not.toBeInTheDocument();
  });

  test("localizes singleton resource titles and field labels in Chinese locale", async () => {
    vi.spyOn(configGraph, "getConfigGraph").mockResolvedValue(configGraphFixture());

    renderWithConsoleProviders(<DefaultsPage />, { locale: "zh-CN" });

    expect(await screen.findByRole("heading", { level: 2, name: "默认值" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "追踪" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "日志" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("默认值 main 状态")).getByText("已保存")).toBeInTheDocument();
    expect(getMaterialTextField(document, "默认模型")).toBeInTheDocument();
    expect(getMaterialTextField(document, "全局系统提示词")).toBeInTheDocument();
    expect(getMaterialSelect(document, "日志级别")).toBeInTheDocument();
  });
});

type MaterialTextFieldElement = HTMLElement & {
  label: string;
  value: string;
};

type MaterialSelectElement = HTMLElement & {
  label: string;
  value: string;
};

async function findMaterialTextField(container: ParentNode, label: string) {
  await screen.findByRole("heading", { level: 2, name: "Defaults" });
  return getMaterialTextField(container, label);
}

function getMaterialTextField(container: ParentNode, label: string) {
  const element = Array.from(container.querySelectorAll<MaterialTextFieldElement>("md-outlined-text-field")).find(
    (candidate) => materialElementLabel(candidate) === label
  );
  if (!element) {
    throw new Error(`Expected a Material Web outlined text field labelled "${label}".`);
  }
  return element;
}

function expectLobeLeadingIcon(fieldElement: HTMLElement, title?: string) {
  const leadingIcon = fieldElement.querySelector("[slot='leading-icon']");
  expect(leadingIcon).toBeInTheDocument();
  expect(leadingIcon?.querySelector("svg")).toBeInTheDocument();
  if (title) {
    expect(leadingIcon?.querySelector("title")).toHaveTextContent(title);
  }
}

function getMaterialSelect(container: ParentNode, label: string) {
  const element = Array.from(container.querySelectorAll<MaterialSelectElement>("md-outlined-select")).find(
    (candidate) => materialElementLabel(candidate) === label
  );
  if (!element) {
    throw new Error(`Expected a Material Web select labelled "${label}".`);
  }
  return element;
}

function materialElementLabel(element: HTMLElement & { label?: string }) {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
  }
  return element.label || element.getAttribute("aria-label") || element.getAttribute("label") || "";
}

function setMaterialTextFieldValue(element: MaterialTextFieldElement, value: string) {
  act(() => {
    element.value = value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
  });
}

function queryMaterialFilledButton(container: ParentNode, label: string) {
  return Array.from(container.querySelectorAll("md-filled-button")).find((candidate) => {
    const accessibleLabel = candidate.getAttribute("aria-label") ?? candidate.textContent ?? "";
    return accessibleLabel.includes(label);
  }) ?? null;
}

async function advanceAutosave() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(450);
    await Promise.resolve();
  });
}
