import { type RefObject, useEffect, useState } from "react";

export type TooltipPosition = {
  left: number;
  maxWidth: number;
  top: number;
};

const tooltipViewportPadding = 12;
const tooltipAnchorGap = 8;
const tooltipPreferredWidth = 320;

export function useAnchoredTooltipPosition(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean
): TooltipPosition | undefined {
  const [position, setPosition] = useState<TooltipPosition>();

  useEffect(() => {
    if (!open) {
      setPosition(undefined);
      return undefined;
    }

    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) {
        setPosition(undefined);
        return;
      }
      setPosition(calculateTooltipPosition(anchor.getBoundingClientRect()));
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, open]);

  return position;
}

function calculateTooltipPosition(anchorRect: DOMRect): TooltipPosition {
  const viewportWidth = Math.max(window.innerWidth || tooltipPreferredWidth, tooltipViewportPadding * 2);
  const maxWidth = Math.max(0, viewportWidth - tooltipViewportPadding * 2);
  const tooltipWidth = Math.min(tooltipPreferredWidth, maxWidth);
  const preferredLeft = anchorRect.right - tooltipWidth;
  const maxLeft = viewportWidth - tooltipViewportPadding - tooltipWidth;
  return {
    left: Math.round(clamp(preferredLeft, tooltipViewportPadding, maxLeft)),
    maxWidth: Math.round(maxWidth),
    top: Math.round(anchorRect.bottom + tooltipAnchorGap)
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
