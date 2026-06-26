import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CONSOLE_LOCALE_STORAGE_KEY,
  I18nProvider,
  translateMessage,
  useI18n
} from "./I18nProvider";

function Probe() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <p data-testid="title">{t("nav.overview")}</p>
      <p data-testid="routes">{t("overview.routes")}</p>
      <button type="button" onClick={() => setLocale("en-US")}>
        English
      </button>
      <button type="button" onClick={() => setLocale("zh-CN")}>
        Chinese
      </button>
    </div>
  );
}

describe("I18nProvider", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("defaults to Chinese when navigator language is zh", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("zh-CN");

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("zh-CN");
    expect(screen.getByTestId("title")).toHaveTextContent("概览");
    expect(screen.getByTestId("routes")).toHaveTextContent("路由");
  });

  test("supports switching to English and persists the choice", async () => {
    const user = userEvent.setup();
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("zh-CN");

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );

    await user.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(screen.getByTestId("title")).toHaveTextContent("Overview");
    expect(localStorage.getItem(CONSOLE_LOCALE_STORAGE_KEY)).toBe("en-US");
  });

  test("uses stored language before navigator language", () => {
    localStorage.setItem(CONSOLE_LOCALE_STORAGE_KEY, "en-US");
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("zh-CN");

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(screen.getByTestId("title")).toHaveTextContent("Overview");
  });

  test("translates messages outside React from the stored locale", () => {
    localStorage.setItem(CONSOLE_LOCALE_STORAGE_KEY, "zh-CN");

    expect(translateMessage("error.requestFailedWithStatus", { status: 502 })).toBe("请求失败，状态码 502");
  });

  test("keeps working when localStorage is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      }
    });
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(screen.getByTestId("title")).toHaveTextContent("Overview");

    if (original) {
      Object.defineProperty(window, "localStorage", original);
    }
  });
});
