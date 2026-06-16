import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { renderWithConsoleProviders } from "../../test/renderWithConsoleProviders";
import * as configGraph from "../../rpc/configGraph";
import { configGraphFixture } from "../../test/configGraphFixtures";
import { SecurityPage } from "./SecurityPage";

describe("SecurityPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders server security fields with write-only auth token", async () => {
    vi.spyOn(configGraph, "getConfigGraph").mockResolvedValue(configGraphFixture());

    renderWithConsoleProviders(<SecurityPage />);

    expect(await screen.findByRole("heading", { level: 2, name: "Server" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Server")).getByRole("heading", { level: 3, name: "main" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Server main status")).getByText("Restart required")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Server main status")).getByText("Critical")).toBeInTheDocument();
    expect(screen.getByLabelText("Listen address")).toHaveValue(":38440");
    expect(screen.getByLabelText("Max sessions")).toHaveValue("64");
    expect(screen.getByLabelText("Session TTL")).toHaveValue("24h");
    expect(screen.getByLabelText("Auth token")).toHaveValue("");
    expect(screen.queryByDisplayValue("******")).not.toBeInTheDocument();
    expect(screen.getByText("Restart required")).toBeInTheDocument();
  });

  test("localizes page chrome in Chinese locale", async () => {
    vi.spyOn(configGraph, "getConfigGraph").mockResolvedValue(configGraphFixture());

    renderWithConsoleProviders(<SecurityPage />, { locale: "zh-CN" });

    expect(await screen.findByRole("heading", { level: 2, name: "服务访问" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("服务访问 main 状态")).getByText("需要重启")).toBeInTheDocument();
    expect(getMaterialTextField(document, "认证 Token").supportingText).toBe("输入新值以替换已保存的密钥。");
    expect(getMaterialTextField(document, "认证 Token")).toHaveAttribute("aria-label", "认证 Token");
    expect(screen.queryByLabelText("Auth Token")).not.toBeInTheDocument();
  });
});

type MaterialTextFieldElement = HTMLElement & {
  label: string;
  supportingText: string;
};

function getMaterialTextField(container: ParentNode, label: string) {
  const element = Array.from(container.querySelectorAll<MaterialTextFieldElement>("md-outlined-text-field")).find(
    (candidate) => candidate.label === label || candidate.getAttribute("aria-label") === label
  );
  if (!element) {
    throw new Error(`Expected a Material Web outlined text field labelled "${label}".`);
  }
  return element;
}
