import "@material/web/dialog/dialog.js";
import { createElement, useEffect, useRef, type ReactNode } from "react";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import { MaterialIconButton } from "./MaterialButton";

type MaterialDialogProps = {
  /** Controlled open state. When true the underlying md-dialog is shown. */
  open: boolean;
  /** Called when the dialog closes (scrim click, Escape, or the close button). */
  onClose: () => void;
  /** Accessible name for the dialog surface. */
  ariaLabel?: string;
  /** Headline text/node rendered in the headline slot. */
  headline?: ReactNode;
  /** Footer actions rendered in the actions slot. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * React bridge over the official Material Web `md-dialog`.
 *
 * The element owns its own show/close animations; this wrapper reconciles the
 * controlled `open` prop with the imperative `show()`/`close()` API and forwards
 * the `close` event (fired on scrim/Escape/programmatic close) back as `onClose`.
 */
export function MaterialDialog({
  open,
  onClose,
  ariaLabel,
  headline,
  actions,
  className,
  children
}: MaterialDialogProps) {
  const ref = useRef<MdDialog>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Reconcile the controlled open flag with the imperative md-dialog API.
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    if (open && typeof el.show === "function" && !el.open) {
      el.show().catch(() => {
        /* show() rejects if already showing or not connected; safe to ignore */
      });
    } else if (!open && typeof el.close === "function" && el.open) {
      el.close();
    }
  }, [open]);

  // Forward close events (scrim / Escape / programmatic) back to React.
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const handleClose = () => onCloseRef.current();
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, []);

  return (
    <md-dialog ref={ref} aria-label={ariaLabel} className={className}>
      {headline ? (
        <div slot="headline" className="material-dialog__headline">
          <span className="material-dialog__headline-text">{headline}</span>
          <MaterialIconButton
            className="material-dialog__close"
            icon="close"
            label="Close"
            onClick={onClose}
          />
        </div>
      ) : null}
      <div slot="content" className="material-dialog__content">
        {children}
      </div>
      {actions ? <div slot="actions">{actions}</div> : null}
    </md-dialog>
  );
}

// Re-exported for callers that need to render the host element directly.
export { createElement };
