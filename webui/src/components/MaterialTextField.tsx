import "@material/web/textfield/filled-text-field.js";
import "@material/web/textfield/outlined-text-field.js";
import { createElement, forwardRef, type ForwardedRef, type ReactNode, useCallback, useEffect, useRef } from "react";
import type { MdFilledTextField } from "@material/web/textfield/filled-text-field.js";
import type { MdOutlinedTextField, TextFieldType } from "@material/web/textfield/outlined-text-field.js";

type MaterialTextFieldProps = {
  ariaDescribedBy?: string;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  error?: boolean;
  errorText?: string;
  className?: string;
  id?: string;
  label: string;
  leadingIcon?: string;
  leadingIconNode?: ReactNode;
  onBlur?: () => void;
  onInput: (value: string) => void;
  inputMode?: string;
  rows?: number;
  spellCheck?: boolean;
  step?: string;
  supportingText?: string;
  required?: boolean;
  trailingIcon?: ReactNode;
  type?: TextFieldType;
  value: string;
};

export type MaterialTextFieldElement = MdFilledTextField | MdOutlinedTextField;

export const MaterialFilledTextField = forwardRef<MaterialTextFieldElement, MaterialTextFieldProps>(
  function MaterialFilledTextField(props, ref) {
    return <MaterialTextField ref={ref} tagName="md-filled-text-field" {...props} />;
  }
);

export const MaterialOutlinedTextField = forwardRef<MaterialTextFieldElement, MaterialTextFieldProps>(
  function MaterialOutlinedTextField({
    ariaDescribedBy,
    ariaLabel,
    ariaInvalid,
    autoFocus,
    autoComplete,
    className,
    disabled,
    error,
    errorText,
    id,
    label,
    leadingIcon,
    leadingIconNode,
    onBlur,
    onInput,
    inputMode,
    rows,
    spellCheck,
    step,
    supportingText,
    required,
    trailingIcon,
    type = "text",
    value
  }: MaterialTextFieldProps, ref) {
    return (
      <MaterialTextField
        ref={ref}
        ariaDescribedBy={ariaDescribedBy}
        ariaLabel={ariaLabel}
        ariaInvalid={ariaInvalid}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        className={className}
        disabled={disabled}
        error={error}
        errorText={errorText}
        id={id}
        label={label}
        leadingIcon={leadingIcon}
        leadingIconNode={leadingIconNode}
        onBlur={onBlur}
        onInput={onInput}
        inputMode={inputMode}
        rows={rows}
        spellCheck={spellCheck}
        step={step}
        supportingText={supportingText}
        required={required}
        trailingIcon={trailingIcon}
        type={type}
        value={value}
        tagName="md-outlined-text-field"
      />
    );
});

type MaterialTextFieldTagName = "md-filled-text-field" | "md-outlined-text-field";

const MaterialTextField = forwardRef<MaterialTextFieldElement, MaterialTextFieldProps & { tagName: MaterialTextFieldTagName }>(
  function MaterialTextField({
    ariaDescribedBy,
    ariaLabel,
    ariaInvalid = false,
    autoFocus = false,
    autoComplete,
    className,
    disabled = false,
    error = false,
    errorText,
    id,
    label,
    leadingIcon,
    leadingIconNode,
    onBlur,
    onInput,
    inputMode,
    rows,
    spellCheck,
    step,
    supportingText,
    required = false,
    trailingIcon,
    type = "text",
    value,
    tagName
  }, forwardedRef) {
    const fieldRef = useRef<MaterialTextFieldElement>(null);
    const setFieldRef = useCallback((field: MaterialTextFieldElement | null) => {
      fieldRef.current = field;
      assignRef(forwardedRef, field);
    }, [forwardedRef]);

    useEffect(() => {
      const field = fieldRef.current;
      if (!field) {
        throw new Error("MaterialTextField rendered before the Material Web text field was registered.");
      }
      const handleInput = () => onInput(field.value);
      field.addEventListener("input", handleInput);
      return () => field.removeEventListener("input", handleInput);
    }, [onInput]);

    useEffect(() => {
      const field = fieldRef.current;
      if (!field) {
        throw new Error("MaterialTextField rendered before the Material Web text field was registered.");
      }
      field.label = label;
      field.type = type;
      field.value = value;
      field.autocomplete = autoComplete ?? "";
      field.disabled = disabled;
      field.error = error;
      field.errorText = errorText ?? "";
      field.supportingText = supportingText ?? "";
      field.required = required;
      field.spellcheck = spellCheck ?? false;
      field.setAttribute("spellcheck", spellCheck ?? false ? "true" : "false");
      if (label) {
        field.setAttribute("label", label);
      } else {
        field.removeAttribute("label");
      }
      field.inputMode = inputMode ?? "";
      if (ariaLabel) {
        field.setAttribute("aria-label", ariaLabel);
      } else {
        field.removeAttribute("aria-label");
      }
      if (ariaInvalid) {
        field.setAttribute("aria-invalid", "true");
      } else {
        field.removeAttribute("aria-invalid");
      }
      if (ariaDescribedBy) {
        field.setAttribute("aria-describedby", ariaDescribedBy);
      } else {
        field.removeAttribute("aria-describedby");
      }
      if (rows !== undefined) {
        field.rows = rows;
      }
      if (step !== undefined) {
        field.step = step;
      }
    }, [
      ariaDescribedBy,
      ariaInvalid,
      ariaLabel,
      autoComplete,
      disabled,
      error,
      errorText,
      inputMode,
      label,
      rows,
      spellCheck,
      step,
      supportingText,
      required,
      type,
      value
    ]);

    const resolvedClassName = mergeClassNames(
      className,
      type !== "textarea" && rows === undefined ? "material-text-field--single-line" : undefined
    );

    return createElement(
      tagName,
      {
        ref: setFieldRef,
        autoFocus,
        className: resolvedClassName,
        id,
        onBlur
      },
      renderLeadingIcon(leadingIcon, leadingIconNode),
      trailingIcon
    );
  }
);

function renderLeadingIcon(leadingIcon: string | undefined, leadingIconNode: ReactNode | undefined) {
  if (leadingIconNode) {
    return createElement(
      "span",
      { "aria-hidden": "true", className: "material-field-leading-node", slot: "leading-icon" },
      leadingIconNode
    );
  }
  return leadingIcon ? createElement("md-icon", { slot: "leading-icon" }, leadingIcon) : null;
}

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) {
    ref.current = value;
  }
}
