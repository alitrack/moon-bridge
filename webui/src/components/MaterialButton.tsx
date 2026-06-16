import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/icon/icon.js";
import "@material/web/iconbutton/icon-button.js";
import { createElement, forwardRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { MdOutlinedButton } from "@material/web/button/outlined-button.js";
import type { MdIconButton } from "@material/web/iconbutton/icon-button.js";

type MaterialOutlinedButtonProps = {
  ariaExpanded?: boolean;
  ariaLabel?: string;
  ariaPressed?: boolean;
  children: ReactNode;
  className?: string;
  controls?: string;
  disabled?: boolean;
  id?: string;
  icon?: string;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  type?: "button" | "reset" | "submit";
};

type MaterialFilledButtonProps = {
  ariaLabel?: string;
  ariaPressed?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  icon?: string;
  onClick?: () => void;
  type?: "button" | "reset" | "submit";
};

type MaterialIconButtonProps = {
  ariaExpanded?: boolean;
  className?: string;
  controls?: string;
  describedBy?: string;
  disabled?: boolean;
  icon: string;
  label: string;
  onBlur?: () => void;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  onFocus?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  onMouseDown?: (event: MouseEvent<HTMLElement>) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  slot?: string;
};

export const MaterialOutlinedButton = forwardRef<MdOutlinedButton, MaterialOutlinedButtonProps>(
  function MaterialOutlinedButton({
    ariaExpanded,
    ariaLabel,
    ariaPressed,
    children,
    className,
    controls,
    disabled = false,
    id,
    icon,
    onClick,
    type = "button"
  }: MaterialOutlinedButtonProps, ref) {
    return (
      <md-outlined-button
        aria-controls={controls}
        aria-expanded={ariaBoolean(ariaExpanded)}
        aria-label={ariaLabel}
        aria-pressed={ariaBoolean(ariaPressed)}
        className={className}
        disabled={disabled}
        id={id}
        onClick={onClick}
        ref={ref}
        type={type}
        {...(icon ? { "has-icon": true } : {})}
      >
        {icon ? createElement("md-icon", { slot: "icon" }, icon) : null}
        {children}
      </md-outlined-button>
    );
  }
);

export function MaterialFilledButton({
  ariaLabel,
  ariaPressed,
  children,
  className,
  disabled = false,
  icon,
  onClick,
  type = "button"
}: MaterialFilledButtonProps) {
  return (
    <md-filled-button
      aria-label={ariaLabel}
      aria-pressed={ariaBoolean(ariaPressed)}
      className={className}
      disabled={disabled}
      onClick={onClick}
      type={type}
      {...(icon ? { "has-icon": true } : {})}
    >
      {icon ? createElement("md-icon", { slot: "icon" }, icon) : null}
      {children}
    </md-filled-button>
  );
}

export const MaterialIconButton = forwardRef<MdIconButton, MaterialIconButtonProps>(
  function MaterialIconButton({
    ariaExpanded,
    className,
    controls,
    describedBy,
    disabled = false,
    icon,
    label,
    onBlur,
    onClick,
    onFocus,
    onKeyDown,
    onMouseDown,
    onMouseEnter,
    onMouseLeave,
    slot
  }: MaterialIconButtonProps, ref) {
    return (
      <md-icon-button
        aria-controls={controls}
        aria-describedby={describedBy}
        aria-expanded={ariaBoolean(ariaExpanded)}
        aria-label={label}
        className={className}
        disabled={disabled}
        onBlur={onBlur}
        onClick={onClick}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        ref={ref}
        slot={slot}
        type="button"
      >
        {createElement("md-icon", null, icon)}
      </md-icon-button>
    );
  }
);

function ariaBoolean(value: boolean | undefined): "true" | "false" | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value ? "true" : "false";
}
