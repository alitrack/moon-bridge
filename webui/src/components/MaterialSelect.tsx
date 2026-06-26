import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import { type ReactNode, useEffect, useRef } from "react";
import type { MdOutlinedSelect } from "@material/web/select/outlined-select.js";
import type { MdSelectOption } from "@material/web/select/select-option.js";

export type MaterialSelectOption = {
  label: string;
  leadingIcon?: ReactNode;
  value: string;
};

type MaterialSelectProps = {
  ariaLabel?: string;
  className?: string;
  describedBy?: string;
  disabled?: boolean;
  error?: boolean;
  errorText?: string;
  label: string;
  leadingIcon?: ReactNode;
  onChange: (value: string) => void;
  options: MaterialSelectOption[];
  required?: boolean;
  supportingText?: string;
  value: string;
};

export function MaterialSelect({
  ariaLabel,
  className,
  describedBy,
  disabled = false,
  error = false,
  errorText,
  label,
  leadingIcon,
  onChange,
  options,
  required = false,
  supportingText,
  value
}: MaterialSelectProps) {
  const selectRef = useRef<MdOutlinedSelect>(null);

  useEffect(() => {
    const selectElement = selectRef.current;
    if (!selectElement) {
      throw new Error("MaterialSelect rendered before md-outlined-select was registered.");
    }
    const handleChange = () => onChange(selectedMaterialSelectValue(selectElement));
    selectElement.addEventListener("change", handleChange);
    return () => selectElement.removeEventListener("change", handleChange);
  }, [onChange]);

  useEffect(() => {
    const selectElement = selectRef.current;
    if (!selectElement) {
      throw new Error("MaterialSelect rendered before md-outlined-select was registered.");
    }
    selectElement.label = label;
    selectElement.disabled = disabled;
    selectElement.error = error;
    selectElement.errorText = errorText ?? "";
    selectElement.required = required;
    selectElement.supportingText = supportingText ?? "";
    selectElement.menuPositioning = "popover";
    selectElement.clampMenuWidth = true;
    selectElement.value = value;
    if (label) {
      selectElement.setAttribute("label", label);
    } else {
      selectElement.removeAttribute("label");
    }
    if (ariaLabel) {
      selectElement.setAttribute("aria-label", ariaLabel);
    } else {
      selectElement.removeAttribute("aria-label");
    }
    if (describedBy) {
      selectElement.setAttribute("aria-describedby", describedBy);
    } else {
      selectElement.removeAttribute("aria-describedby");
    }
  }, [ariaLabel, describedBy, disabled, error, errorText, label, required, supportingText, value, options]);

  const resolvedClassName = mergeClassNames(className, "material-select--single-line");

  return (
    <md-outlined-select ref={selectRef} className={resolvedClassName}>
      {leadingIcon ? (
        <span aria-hidden="true" className="material-select-leading-node" slot="leading-icon">
          {leadingIcon}
        </span>
      ) : null}
      {options.map((option) => (
        <MaterialSelectOptionElement
          key={option.value}
          label={option.label}
          leadingIcon={option.leadingIcon}
          selected={option.value === value}
          value={option.value}
        />
      ))}
    </md-outlined-select>
  );
}

function selectedMaterialSelectValue(selectElement: MdOutlinedSelect) {
  if (selectElement.value) {
    return selectElement.value;
  }
  const selectedOption = Array.from(selectElement.querySelectorAll<MdSelectOption>("md-select-option"))
    .find((option) => option.selected);
  return selectedOption?.value || selectedOption?.getAttribute("value") || selectedOption?.getAttribute("data-value") || "";
}

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

type MaterialSelectOptionElementProps = {
  label: string;
  leadingIcon?: ReactNode;
  selected: boolean;
  value: string;
};

function MaterialSelectOptionElement({ label, leadingIcon, selected, value }: MaterialSelectOptionElementProps) {
  const optionRef = useRef<MdSelectOption>(null);

  useEffect(() => {
    const optionElement = optionRef.current;
    if (!optionElement) {
      throw new Error("MaterialSelectOption rendered before md-select-option was registered.");
    }
    optionElement.value = value;
    optionElement.displayText = label;
    optionElement.selected = selected;
  }, [label, selected, value]);

  return (
    <md-select-option
      ref={optionRef}
      data-value={value}
      display-text={label}
      selected={selected}
      value={value}
    >
      {leadingIcon ? (
        <span aria-hidden="true" className="material-select-option-icon" slot="start">
          {leadingIcon}
        </span>
      ) : null}
      <span slot="headline">{label}</span>
    </md-select-option>
  );
}
