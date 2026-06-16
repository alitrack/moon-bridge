import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { renderWithConsoleProviders } from "../../test/renderWithConsoleProviders";
import { FieldStatus } from "./FieldStatus";

describe("FieldStatus", () => {
  test("renders compact save state labels", () => {
    const { unmount } = renderWithConsoleProviders(<FieldStatus status="saving" />);

    expect(screen.getByText("Saving")).toBeInTheDocument();

    unmount();
    renderWithConsoleProviders(<FieldStatus status="error" message="invalid value" />);

    expect(screen.getByText("invalid value")).toBeInTheDocument();
  });

  test("exposes status metadata for icon-ready styling", () => {
    renderWithConsoleProviders(<FieldStatus status="dirty" />);

    expect(screen.getByRole("status")).toHaveAttribute("data-status", "dirty");
    expect(screen.getByRole("status").querySelector(".field-status__dot")).toBeInTheDocument();
  });

  test("localizes save state labels in Chinese locale", () => {
    renderWithConsoleProviders(<FieldStatus status="saving" />, { locale: "zh-CN" });

    expect(screen.getByText("保存中")).toBeInTheDocument();
  });
});
