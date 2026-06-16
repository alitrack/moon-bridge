import "@material/web/switch/switch.js";
import { useEffect, useRef } from "react";
import type { MdSwitch } from "@material/web/switch/switch.js";

type MaterialSwitchProps = {
  disabled?: boolean;
  label: string;
  onChange: (selected: boolean) => void;
  selected: boolean;
};

export function MaterialSwitch({ disabled = false, label, onChange, selected }: MaterialSwitchProps) {
  const switchRef = useRef<MdSwitch>(null);

  useEffect(() => {
    const switchElement = switchRef.current;
    if (!switchElement) {
      throw new Error("MaterialSwitch rendered before md-switch was registered.");
    }
    const handleChange = () => onChange(switchElement.selected);
    switchElement.addEventListener("change", handleChange);
    return () => switchElement.removeEventListener("change", handleChange);
  }, [onChange]);

  useEffect(() => {
    if (!switchRef.current) {
      throw new Error("MaterialSwitch rendered before md-switch was registered.");
    }
    switchRef.current.selected = selected;
  }, [selected]);

  useEffect(() => {
    if (!switchRef.current) {
      throw new Error("MaterialSwitch rendered before md-switch was registered.");
    }
    switchRef.current.disabled = disabled;
  }, [disabled]);

  return (
    <md-switch
      ref={switchRef}
      aria-label={label}
    />
  );
}
