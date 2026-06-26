import "@material/web/chips/assist-chip.js";
import "@material/web/chips/chip-set.js";
import "@material/web/chips/filter-chip.js";
import { createElement, useEffect, useRef, type ReactNode } from "react";
import type { MdFilterChip } from "@material/web/chips/filter-chip.js";

type MaterialFilterChipProps<Value extends string> = {
  children: ReactNode;
  onSelect: (value: Value) => void;
  selected: boolean;
  value: Value;
};

export function MaterialFilterChip<Value extends string>({
  children,
  onSelect,
  selected,
  value
}: MaterialFilterChipProps<Value>) {
  const chipRef = useRef<MdFilterChip>(null);

  useEffect(() => {
    const chip = chipRef.current;
    if (!chip) {
      throw new Error("MaterialFilterChip rendered before md-filter-chip was registered.");
    }
    const handleClick = () => {
      onSelect(value);
      if (selected) {
        window.requestAnimationFrame(() => {
          if (chipRef.current) {
            chipRef.current.selected = true;
          }
        });
      }
    };
    chip.addEventListener("click", handleClick);
    return () => chip.removeEventListener("click", handleClick);
  }, [onSelect, selected, value]);

  useEffect(() => {
    if (!chipRef.current) {
      throw new Error("MaterialFilterChip rendered before md-filter-chip was registered.");
    }
    chipRef.current.selected = selected;
  }, [selected]);

  return (
    <md-filter-chip ref={chipRef}>
      {children}
    </md-filter-chip>
  );
}

export function MaterialAssistChip({ children }: { children: ReactNode }) {
  return createElement("md-assist-chip", null, children);
}
