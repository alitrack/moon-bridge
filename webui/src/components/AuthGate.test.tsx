import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithConsoleProviders } from "../test/renderWithConsoleProviders";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "../rpc/http";
import { expectPanelElementToBeFlat } from "../test/panelStyleAssertions";
import { AuthGate } from "./AuthGate";

describe("AuthGate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders children when there is no auth error", () => {
    renderWithConsoleProviders(<AuthGate>Console content</AuthGate>);

    expect(screen.getByText("Console content")).toBeInTheDocument();
  });

  test("calls onSubmit with the token and remember flag", async () => {
    const onSubmit = vi.fn();

    renderWithConsoleProviders(
      <AuthGate error={new ApiError(401, "invalid_auth", "missing token")} onSubmit={onSubmit}>
        Console content
      </AuthGate>
    );

    const tokenField = getMaterialTextField(document, "Token");
    const submitButton = getMaterialButton(document, "Save token");
    expect(tokenField.type).toBe("password");
    expect(submitButton.type).toBe("submit");

    setMaterialTextFieldValue(tokenField, "secret-token");
    await submitAuthForm(submitButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("secret-token", false));
  });

  test("toggles token visibility through the trailing icon button", async () => {
    renderWithConsoleProviders(
      <AuthGate error={new ApiError(401, "invalid_auth", "missing token")}>
        Console content
      </AuthGate>
    );

    const tokenField = getMaterialTextField(document, "Token");
    // Hidden by default; the trailing toggle reveals it.
    expect(tokenField.type).toBe("password");
    const showButton = getMaterialIconButton(document, "Show token");

    await userEvent.click(showButton);

    expect(tokenField.type).toBe("text");
    expect(getMaterialIconButton(document, "Hide token")).toBeInTheDocument();
  });

  test("forwards remember=true when the checkbox is checked", async () => {
    const onSubmit = vi.fn();

    renderWithConsoleProviders(
      <AuthGate error={new ApiError(401, "invalid_auth", "missing token")} onSubmit={onSubmit}>
        Console content
      </AuthGate>
    );

    const tokenField = getMaterialTextField(document, "Token");
    const rememberCheckbox = getMaterialCheckbox(document, "Remember on this device");

    setMaterialTextFieldValue(tokenField, "remembered-token");
    setMaterialCheckboxChecked(rememberCheckbox, true);
    await submitAuthForm(getMaterialButton(document, "Save token"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("remembered-token", true));
  });

  test("disables and relabels the submit button while pending", () => {
    renderWithConsoleProviders(
      <AuthGate error={new ApiError(401, "invalid_auth", "missing token")} pending>
        Console content
      </AuthGate>
    );

    const submitButton = getMaterialButton(document, "Verifying…");
    expect(submitButton).toBeInTheDocument();
    expect((submitButton as unknown as { disabled: boolean }).disabled).toBe(true);
  });

  test("localizes authentication controls in Chinese locale", () => {
    renderWithConsoleProviders(
      <AuthGate error={new ApiError(401, "invalid_auth", "missing token")}>
        Console content
      </AuthGate>,
      { locale: "zh-CN" }
    );

    expect(getMaterialTextField(document, "Token")).toBeInTheDocument();
    expect(getMaterialCheckbox(document, "在此设备记住")).toBeInTheDocument();
    expect(getMaterialButton(document, "保存 Token")).toBeInTheDocument();
  });

  test("renders the auth background panel without borders or glow", () => {
    renderWithConsoleProviders(
      <AuthGate error={new ApiError(401, "invalid_auth", "missing token")}>
        Console content
      </AuthGate>
    );

    const authCard = document.querySelector(".auth-card");
    expect(authCard).toBeInTheDocument();
    expectPanelElementToBeFlat(authCard!);
  });
});

function getMaterialTextField(container: ParentNode, label: string) {
  const element = Array.from(container.querySelectorAll("md-outlined-text-field")).find(
    (textField) => (textField as HTMLElement & { label: string }).label === label
  );
  if (!element) {
    throw new Error(`Expected a Material Web text field labelled "${label}".`);
  }
  return element as HTMLElement & { label: string; type: string; value: string };
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

function getMaterialCheckbox(container: ParentNode, label: string) {
  const element = Array.from(container.querySelectorAll("md-checkbox")).find(
    (checkbox) => checkbox.getAttribute("aria-label") === label
  );
  if (!element) {
    throw new Error(`Expected a Material Web checkbox labelled "${label}".`);
  }
  return element as HTMLElement & { checked: boolean };
}

function getMaterialButton(container: ParentNode, label: string) {
  const element = Array.from(container.querySelectorAll("md-filled-button")).find(
    (button) => button.textContent?.trim() === label
  );
  if (!element) {
    throw new Error(`Expected a Material Web filled button labelled "${label}".`);
  }
  return element as HTMLElement & { type: string };
}

function setMaterialTextFieldValue(element: HTMLElement & { value: string }, value: string) {
  act(() => {
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function setMaterialCheckboxChecked(element: HTMLElement & { checked: boolean }, checked: boolean) {
  act(() => {
    element.checked = checked;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function submitAuthForm(button: HTMLElement) {
  const form = button.closest("form");
  if (!form) {
    throw new Error("Expected Material Web submit button inside AuthGate form.");
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
