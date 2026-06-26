import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "../../app/App";
import { renderWithConsoleProviders } from "../../test/renderWithConsoleProviders";
import { afterEach, describe, expect, test, vi } from "vitest";
import * as responses from "../../rpc/responses";
import { RpcTestPage } from "./RpcTestPage";

if (!Element.prototype.animate) {
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: () => ({
      addEventListener: () => undefined,
      cancel: () => undefined,
      commitStyles: () => undefined,
      finish: () => undefined,
      finished: Promise.resolve(),
      pause: () => undefined,
      persist: () => undefined,
      play: () => undefined,
      ready: Promise.resolve(),
      removeEventListener: () => undefined,
      reverse: () => undefined,
      updatePlaybackRate: () => undefined
    } as unknown as Animation)
  });
}

describe("RpcTestPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders official Material Web form controls", async () => {
    vi.spyOn(responses, "listResponseModels").mockResolvedValue({
      models: [{ slug: "moonbridge", name: "Moon Bridge", provider: "route" }]
    });

    const { container } = renderWithConsoleProviders(<RpcTestPage />);

    await screen.findByText("moonbridge");

    expect(getMaterialSelect(container, "Model")).toBeInTheDocument();
    expect(getMaterialTextField(container, "Input")).toHaveProperty("type", "textarea");
    expect(getMaterialTextField(container, "Input")).not.toHaveClass("material-text-field--single-line");
    expect(getMaterialTextField(container, "Max Output Tokens")).toHaveProperty("type", "number");
    expect(getMaterialTextField(container, "Max Output Tokens")).toHaveClass("material-text-field--single-line");
    expect(getMaterialTextField(container, "Temperature")).toHaveProperty("type", "number");
    expect(getMaterialTextField(container, "Temperature")).toHaveClass("material-text-field--single-line");
    expect(getMaterialButton(container, "Send")).toBeInTheDocument();
  });

  test("keeps Material selects aligned with single-line text field density", async () => {
    vi.spyOn(responses, "listResponseModels").mockResolvedValue({
      models: [{ slug: "moonbridge", name: "Moon Bridge", provider: "route" }]
    });

    renderWithConsoleProviders(
      <MemoryRouter>
        <AppShell content={<RpcTestPage />} />
      </MemoryRouter>
    );

    await screen.findByText("moonbridge");

    const materialSelect = getMaterialSelect(document, "Model");
    const materialTextField = getMaterialTextField(document, "Max Output Tokens");
    const selectStyle = getComputedStyle(materialSelect);
    const textFieldStyle = getComputedStyle(materialTextField);

    expect(materialSelect).toHaveClass("material-select--single-line");
    expect(selectStyle.getPropertyValue("--md-outlined-field-top-space").trim()).toBe(
      textFieldStyle.getPropertyValue("--md-outlined-text-field-top-space").trim()
    );
    expect(selectStyle.getPropertyValue("--md-outlined-field-bottom-space").trim()).toBe(
      textFieldStyle.getPropertyValue("--md-outlined-text-field-bottom-space").trim()
    );
    expect(selectStyle.getPropertyValue("--md-outlined-select-text-field-input-text-line-height").trim()).toBe(
      textFieldStyle.getPropertyValue("--md-outlined-text-field-input-text-line-height").trim()
    );
  });

  test("sends a responses smoke test from Material Web controls and shows latency/result", async () => {
    vi.spyOn(responses, "listResponseModels").mockResolvedValue({
      models: [{ slug: "moonbridge", name: "Moon Bridge", provider: "route" }]
    });
    const createResponse = vi.spyOn(responses, "createResponse").mockResolvedValue({
      id: "resp_1",
      status: "completed",
      model: "moonbridge",
      output: [],
      output_text: "pong"
    });

    const { container } = renderWithConsoleProviders(<RpcTestPage />);

    await screen.findByText("moonbridge");
    setMaterialSelectValue(getMaterialSelect(container, "Model"), "moonbridge");
    setMaterialTextFieldValue(getMaterialTextField(container, "Input"), "ping");
    setMaterialTextFieldValue(getMaterialTextField(container, "Max Output Tokens"), "128");
    setMaterialTextFieldValue(getMaterialTextField(container, "Temperature"), "0.4");
    await submitMaterialForm(container);

    await waitFor(() => expect(createResponse).toHaveBeenCalledWith(expect.objectContaining({
      model: "moonbridge",
      input: "ping",
      max_output_tokens: 128,
      temperature: 0.4
    })));
    expect(await screen.findByText(/pong/)).toBeInTheDocument();
    expect(screen.getByText(/latency/i)).toBeInTheDocument();
  });
});

type MaterialSelectElement = HTMLElement & {
  label: string;
  value: string;
};

type MaterialTextFieldElement = HTMLElement & {
  label: string;
  type: string;
  value: string;
};

function getMaterialSelect(container: ParentNode, label: string) {
  const element = Array.from(container.querySelectorAll<MaterialSelectElement>("md-outlined-select")).find(
    (candidate) => candidate.label === label
  );
  if (!element) {
    throw new Error(`Expected a Material Web select labelled "${label}".`);
  }
  return element;
}

function getMaterialTextField(container: ParentNode, label: string) {
  const element = Array.from(container.querySelectorAll<MaterialTextFieldElement>("md-outlined-text-field")).find(
    (candidate) => candidate.label === label
  );
  if (!element) {
    throw new Error(`Expected a Material Web text field labelled "${label}".`);
  }
  return element;
}

function getMaterialButton(container: ParentNode, label: string) {
  const element = Array.from(container.querySelectorAll("md-filled-button")).find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (!element) {
    throw new Error(`Expected a Material Web filled button labelled "${label}".`);
  }
  return element;
}

function setMaterialSelectValue(element: MaterialSelectElement, value: string) {
  act(() => {
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setMaterialTextFieldValue(element: MaterialTextFieldElement, value: string) {
  act(() => {
    element.value = value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
  });
}

async function submitMaterialForm(container: ParentNode) {
  const button = getMaterialButton(container, "Send");
  const form = button.closest("form");
  if (!form) {
    throw new Error("Expected Material submit button to be inside a form.");
  }
  let clicked = false;
  let submitted = false;
  button.addEventListener("click", () => {
    clicked = true;
  }, { once: true });
  form.addEventListener("submit", () => {
    submitted = true;
  }, { once: true });
  await userEvent.click(button);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(clicked).toBe(true);
  if (!submitted) {
    await act(async () => {
      form.requestSubmit();
      await Promise.resolve();
    });
  }
}
