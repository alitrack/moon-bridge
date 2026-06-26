import type { Transition, Variants } from "motion/react";

/**
 * Material Design 3 Expressive motion-physics tokens, expressed as
 * framer-`motion` transitions.
 *
 * M3 Expressive replaces fixed easing/duration with a spring system:
 *  - **Spatial** springs animate position, size and shape; they slightly
 *    overshoot and settle with a gentle bounce.
 *  - **Effects** springs animate colour and opacity; they never overshoot.
 *
 * Each family has three speeds — fast (small components such as switches and
 * buttons), default (partial-surface motion like the navigation rail) and slow
 * (full-surface transitions). Stiffness/damping pairs below map the published
 * M3 Expressive phone tokens to framer-motion's absolute-damping springs.
 */
export const springs = {
  spatialFast: { type: "spring", stiffness: 1400, damping: 50, mass: 1 },
  spatial: { type: "spring", stiffness: 700, damping: 36, mass: 1 },
  spatialSlow: { type: "spring", stiffness: 320, damping: 24, mass: 1 },
  effectsFast: { type: "spring", stiffness: 3800, damping: 120, mass: 1 },
  effects: { type: "spring", stiffness: 1600, damping: 80, mass: 1 },
  effectsSlow: { type: "spring", stiffness: 800, damping: 60, mass: 1 }
} as const satisfies Record<string, Transition>;

/** CSS easing curves matching the M3 standard scheme (for plain transitions). */
export const easing = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  standardDecelerate: "cubic-bezier(0, 0, 0, 1)",
  standardAccelerate: "cubic-bezier(0.3, 0, 1, 1)",
  emphasized: "cubic-bezier(0.2, 0, 0, 1)",
  emphasizedDecelerate: "cubic-bezier(0.05, 0.7, 0.1, 1)",
  emphasizedAccelerate: "cubic-bezier(0.3, 0, 0.8, 0.15)"
} as const;

/** Page/route content enters with an emphasized spatial spring. */
export const pageMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { ...springs.spatial, opacity: springs.effects }
} as const;

/** Cards and panels rise into place with a softer spatial spring. */
export const surfaceMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { ...springs.spatial, opacity: springs.effects }
} as const;

/** Staggered list container — children animate in sequence. */
export const listContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.02 }
  }
};

/** Individual staggered list item. */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { ...springs.spatial, opacity: springs.effects }
  }
};

/** Interactive press feedback for buttons / pressable surfaces. */
export const pressable = {
  whileHover: { scale: 1.015 },
  whileTap: { scale: 0.97 },
  transition: springs.spatialFast
} as const;

/** Expand / collapse helper for revealing panels (delete confirm, drawers). */
export const collapse: Variants = {
  hidden: { opacity: 0, height: 0, y: -4 },
  show: {
    opacity: 1,
    height: "auto",
    y: 0,
    transition: { ...springs.spatial, opacity: springs.effectsFast }
  }
};
