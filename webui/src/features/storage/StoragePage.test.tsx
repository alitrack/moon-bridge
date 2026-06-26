import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { renderWithConsoleProviders } from "../../test/renderWithConsoleProviders";
import * as configGraph from "../../rpc/configGraph";
import { configGraphFixture } from "../../test/configGraphFixtures";
import { StoragePage } from "./StoragePage";

describe("StoragePage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders cache and persistence resources with runtime storage errors", async () => {
    vi.spyOn(configGraph, "getConfigGraph").mockResolvedValue(
      configGraphFixture({
        runtime: {
          status: "runtimeRejected",
          errors: [
            {
              resourceKind: "persistence",
              resourceId: "main",
              field: "active_provider",
              code: "databaseUnavailable",
              message: "database unavailable"
            }
          ]
        }
      })
    );

    renderWithConsoleProviders(<StoragePage />);

    expect(await screen.findByRole("heading", { level: 2, name: "Cache" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Persistence" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Cache")).getByRole("heading", { level: 3, name: "main" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Cache main status")).getByText("Saved")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Persistence main status")).getByText("Saved")).toBeInTheDocument();
    expect(screen.getByLabelText("Cache mode")).toHaveValue("memory");
    expect(screen.getByLabelText("Persistence provider")).toHaveValue("db_sqlite");
    expect(screen.getByText("database unavailable")).toBeInTheDocument();
  });

  test("localizes page chrome in Chinese locale", async () => {
    vi.spyOn(configGraph, "getConfigGraph").mockResolvedValue(configGraphFixture());

    renderWithConsoleProviders(<StoragePage />, { locale: "zh-CN" });

    expect(await screen.findByRole("heading", { level: 2, name: "缓存" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "持久化" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("缓存 main 状态")).getByText("已保存")).toBeInTheDocument();
  });
});
