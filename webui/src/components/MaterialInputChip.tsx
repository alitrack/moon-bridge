import "@material/web/chips/input-chip.js";
import { useEffect, useRef, type ReactNode } from "react";
import type { MdInputChip } from "@material/web/chips/input-chip.js";

type MaterialInputChipProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
  onRemove: () => void;
};

export function MaterialInputChip({
  children,
  className,
  disabled = false,
  label,
  onRemove
}: MaterialInputChipProps) {
  const chipRef = useRef<MdInputChip>(null);

  useEffect(() => {
    const chip = chipRef.current;
    if (!chip) {
      throw new Error("MaterialInputChip rendered before md-input-chip was registered.");
    }
    const handleRemove = () => onRemove();
    chip.addEventListener("remove", handleRemove);
    return () => chip.removeEventListener("remove", handleRemove);
  }, [onRemove]);

  useEffect(() => {
    const chip = chipRef.current;
    if (!chip) {
      throw new Error("MaterialInputChip rendered before md-input-chip was registered.");
    }
    chip.disabled = disabled;
    chip.removeOnly = true;
    chip.setAttribute("aria-label", label);
  }, [disabled, label]);

  return (
    <md-input-chip
      aria-label={label}
      className={className}
      disabled={disabled}
      ref={chipRef}
      remove-only
    >
      {children}
    </md-input-chip>
  );
}
