import { MaterialSelect } from "../../components/MaterialSelect";
import type { ReactNode } from "react";

export type SelectMenuOption = {
  value: string;
  label: string;
  leadingIcon?: ReactNode;
};

export function SelectMenu({
  options,
  value,
  onChange,
  disabled = false,
  describedBy,
  error,
  errorText,
  ariaLabel,
  leadingIcon,
  placeholder,
  required,
  supportingText
}: {
  options: SelectMenuOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  describedBy?: string;
  error?: boolean;
  errorText?: string;
  ariaLabel?: string;
  leadingIcon?: ReactNode;
  placeholder?: string;
  required?: boolean;
  supportingText?: string;
}) {
  return (
    <MaterialSelect
      ariaLabel={ariaLabel}
      describedBy={describedBy}
      disabled={disabled}
      error={error}
      errorText={errorText}
      label={ariaLabel ?? placeholder ?? ""}
      leadingIcon={leadingIcon}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
        leadingIcon: option.leadingIcon
      }))}
      required={required}
      supportingText={supportingText}
      value={value}
      onChange={onChange}
    />
  );
}
