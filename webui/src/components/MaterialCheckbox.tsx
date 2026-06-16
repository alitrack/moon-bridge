import "@material/web/checkbox/checkbox.js";
import { useEffect, useRef } from "react";
import type { MdCheckbox } from "@material/web/checkbox/checkbox.js";

type MaterialCheckboxProps = {
  checked: boolean;
  className?: string;
  label: string;
  onChange: (checked: boolean) => void;
};

export function MaterialCheckbox({ checked, className, label, onChange }: MaterialCheckboxProps) {
  const checkboxRef = useRef<MdCheckbox>(null);

  useEffect(() => {
    const checkbox = checkboxRef.current;
    if (!checkbox) {
      throw new Error("MaterialCheckbox rendered before md-checkbox was registered.");
    }
    const handleChange = () => onChange(checkbox.checked);
    checkbox.addEventListener("change", handleChange);
    return () => checkbox.removeEventListener("change", handleChange);
  }, [onChange]);

  useEffect(() => {
    if (!checkboxRef.current) {
      throw new Error("MaterialCheckbox rendered before md-checkbox was registered.");
    }
    checkboxRef.current.checked = checked;
  }, [checked]);

  return <md-checkbox ref={checkboxRef} aria-label={label} className={className} />;
}
