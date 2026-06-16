import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MaterialDialog } from "./MaterialDialog";

describe("MaterialDialog", () => {
  test("renders the official md-dialog host with aria-label, headline and content", () => {
    const { container } = render(
      <MaterialDialog open={false} onClose={() => undefined} ariaLabel="Edit Route primary" headline="Edit Route">
        <p>route fields</p>
      </MaterialDialog>
    );

    const dialog = container.querySelector("md-dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-label", "Edit Route primary");

    const headlineSlot = container.querySelector('[slot="headline"]');
    expect(headlineSlot).toBeInTheDocument();
    expect(screen.getByText("Edit Route")).toBeInTheDocument();

    const contentSlot = container.querySelector('[slot="content"]');
    expect(contentSlot).toBeInTheDocument();
    expect(screen.getByText("route fields")).toBeInTheDocument();
  });

  test("renders an official Material icon button to close the dialog", () => {
    const { container } = render(
      <MaterialDialog open onClose={() => undefined} headline="Edit Route">
        body
      </MaterialDialog>
    );

    const closeButton = container.querySelector('md-icon-button[aria-label="Close"]');
    expect(closeButton).toBeInTheDocument();
  });

  test("invokes onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <MaterialDialog open={false} onClose={onClose} headline="Edit Route">
        body
      </MaterialDialog>
    );

    fireEvent.click(container.querySelector('md-icon-button[aria-label="Close"]')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("invokes onClose when md-dialog dispatches its close event (scrim/Escape)", () => {
    const onClose = vi.fn();
    const { container } = render(
      <MaterialDialog open onClose={onClose} headline="Edit Route">
        body
      </MaterialDialog>
    );

    const dialog = container.querySelector("md-dialog")!;
    dialog.dispatchEvent(new Event("close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
