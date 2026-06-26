export const baseStyles = `
  :root {
    color-scheme: dark;
    /* Reserve the scrollbar gutter so the layout (and centered dialogs) does not shift
       when a scrollbar appears or disappears — keeps left/right spacing symmetric. */
    scrollbar-gutter: stable;
    font-family:
      "Roboto Flex", Inter, ui-sans-serif, system-ui, -apple-system,
      BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-optical-sizing: auto;
    background: var(--mb-color-surface);
    color: var(--mb-color-on-surface);
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;

    /* ---- M3 Expressive shape scale ---- */
    --mb-shape-xs: 8px;
    --mb-shape-sm: 12px;
    --mb-shape-md: 16px;
    --mb-shape-lg: 20px;
    --mb-shape-xl: 28px;
    --mb-shape-2xl: 36px;
    --mb-shape-full: 999px;

    /* Buttons use a uniform small-radius (square-ish) shape rather than pills. */
    --mb-button-shape: 8px;

    /* All panel/card/dialog backgrounds share one radius for a consistent surface language. */
    --mb-shape-panel: 20px;

    /* ---- Code/mono font ---- */
    --mb-font-mono: "Roboto Mono", "JetBrains Mono", "SFMono-Regular", Consolas, monospace;

    /* ---- M3 Expressive type scale ---- */
    --mb-type-display: 700 clamp(2rem, 1.4rem + 2.4vw, 2.9rem)/1.06 "Roboto Flex", Inter, system-ui, sans-serif;
    --mb-tracking-display: -0.015em;

    /* ---- Content measure: caps the reading/editing width on wide and ultrawide screens so
       content does not stretch into unreadable line lengths, while still filling common
       1440–1920px laptops. Section grids inside keep using auto-fit to fill the column. ---- */
    --mb-content-max: 1560px;
    --mb-content-gutter: clamp(16px, 3.2vw, 44px);

    /* ---- M3 motion easings + durations ---- */
    --mb-ease-standard: cubic-bezier(0.2, 0, 0, 1);
    --mb-ease-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
    --mb-ease-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
    --mb-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --mb-duration-short: 140ms;
    --mb-duration-medium: 240ms;
    --mb-duration-long: 420ms;
    --mb-motion-standard: var(--mb-duration-medium) var(--mb-ease-standard);
    --mb-motion-emphasized: var(--mb-duration-long) var(--mb-ease-decelerate);

    /* ---- State-layer opacities (M3) ---- */
    --mb-state-hover: 0.08;
    --mb-state-focus: 0.10;
    --mb-state-press: 0.12;

    /* ---- Tonal elevation shadows for transient floating surfaces. App panels use tonal color instead. ---- */
    --mb-elevation-1:
      0 1px 2px color-mix(in srgb, var(--mb-color-shadow) 30%, transparent),
      0 1px 3px 1px color-mix(in srgb, var(--mb-color-shadow) 15%, transparent);
    --mb-elevation-2:
      0 1px 2px color-mix(in srgb, var(--mb-color-shadow) 30%, transparent),
      0 2px 6px 2px color-mix(in srgb, var(--mb-color-shadow) 15%, transparent);
    --mb-elevation-3:
      0 4px 8px 3px color-mix(in srgb, var(--mb-color-shadow) 15%, transparent),
      0 1px 3px color-mix(in srgb, var(--mb-color-shadow) 30%, transparent);
    --mb-elevation-4:
      0 6px 10px 4px color-mix(in srgb, var(--mb-color-shadow) 15%, transparent),
      0 2px 3px color-mix(in srgb, var(--mb-color-shadow) 30%, transparent);
    --mb-elevation-5:
      0 8px 12px 6px color-mix(in srgb, var(--mb-color-shadow) 15%, transparent),
      0 4px 4px color-mix(in srgb, var(--mb-color-shadow) 30%, transparent);

    /* Material Symbols default to an outlined, unfilled glyph. */
    --md-icon-font: "Material Symbols Rounded";
    --md-icon-size: 24px;
  }

  :root[data-theme="light"] {
    color-scheme: light;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    min-width: 320px;
    min-height: 100vh;
    background: var(--mb-color-surface);
  }

  md-icon,
  .material-symbol {
    font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24;
    transition: font-variation-settings var(--mb-duration-medium) var(--mb-ease-standard);
  }

  /* Filled icon variant for active/selected expressive states. */
  .nav-item--active md-icon,
  .icon--filled {
    font-variation-settings: "FILL" 1, "wght" 500, "GRAD" 0, "opsz" 24;
  }

  ::selection {
    background: color-mix(in srgb, var(--mb-color-primary) 32%, transparent);
    color: var(--mb-color-on-surface);
  }

  :focus-visible {
    outline: none;
  }

  /* Themed, slim scrollbars to avoid heavy native chrome. */
  * {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--mb-color-outline) 55%, transparent) transparent;
  }
  *::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  *::-webkit-scrollbar-thumb {
    border: 3px solid transparent;
    border-radius: var(--mb-shape-full);
    background: color-mix(in srgb, var(--mb-color-outline) 50%, transparent);
    background-clip: padding-box;
  }
  *::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--mb-color-outline) 80%, transparent);
    background-clip: padding-box;
  }
  *::-webkit-scrollbar-corner {
    background: transparent;
  }

  @keyframes mb-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes mb-shimmer {
    0% { background-position: -480px 0; }
    100% { background-position: 480px 0; }
  }
  @keyframes mb-pulse-ring {
    0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--mb-color-primary) 45%, transparent); }
    70% { box-shadow: 0 0 0 7px color-mix(in srgb, var(--mb-color-primary) 0%, transparent); }
    100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--mb-color-primary) 0%, transparent); }
  }
  @keyframes mb-pop-in {
    0% { opacity: 0; transform: scale(0.8); }
    60% { opacity: 1; transform: scale(1.06); }
    100% { opacity: 1; transform: scale(1); }
  }

  .app-shell {
    min-height: 100vh;
    background:
      radial-gradient(1200px 420px at 12% -8%, color-mix(in srgb, var(--mb-color-primary) 14%, transparent), transparent 70%),
      radial-gradient(900px 360px at 100% -4%, color-mix(in srgb, var(--mb-color-tertiary) 10%, transparent), transparent 72%),
      var(--mb-color-surface);
  }

  .auth-gate {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background:
      radial-gradient(900px 500px at 50% -12%, color-mix(in srgb, var(--mb-color-primary) 20%, transparent), transparent 70%),
      var(--mb-color-surface);
  }

  .auth-card {
    width: min(420px, 100%);
    display: grid;
    gap: 14px;
    border-radius: var(--mb-shape-panel);
    outline: 0;
    padding: 32px;
    background: var(--mb-color-surface-container-high);
  }

  .auth-card__badge {
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    border-radius: var(--mb-shape-lg);
    color: var(--mb-color-on-primary-container);
    background: var(--mb-color-primary-container);
    --md-icon-size: 30px;
  }

  .auth-card h1 {
    margin: 0;
    font-size: 1.6rem;
    line-height: 1.15;
  }

  .auth-card__message {
    margin: 0;
    color: var(--mb-color-on-surface-variant);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .auth-token-field {
    width: 100%;
  }

  /* Smaller (~ -25%) visibility-toggle icon button used inside secret/token
     text fields, so it doesn't dominate the field's trailing area. */
  .field-visibility-toggle {
    --md-icon-button-state-layer-size: 30px;
    --md-icon-size: 18px;
  }

  .auth-remember {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    color: var(--mb-color-on-surface);
    font-size: 0.9rem;
    cursor: pointer;
    user-select: none;
  }

  .auth-remember md-checkbox {
    --md-checkbox-selected-container-color: var(--mb-color-primary);
    --md-checkbox-selected-icon-color: var(--mb-color-on-primary);
    --md-checkbox-selected-hover-container-color: var(--mb-color-primary);
    --md-checkbox-selected-focus-container-color: var(--mb-color-primary);
    --md-checkbox-selected-pressed-container-color: var(--mb-color-primary);
    --md-checkbox-unselected-outline-color: var(--mb-color-outline);
    --md-checkbox-unselected-hover-outline-color: var(--mb-color-on-surface-variant);
    --md-checkbox-unselected-focus-outline-color: var(--mb-color-primary);
  }

  .auth-submit {
    margin-top: 4px;
    width: 100%;
    min-height: 48px;
  }

  .top-app-bar {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    min-height: 68px;
    padding: 10px 24px;
    border-bottom: 1px solid color-mix(in srgb, var(--mb-color-outline) 36%, transparent);
    background: color-mix(in srgb, var(--mb-color-surface) 92%, transparent);
    backdrop-filter: blur(16px);
  }

  .top-app-bar p,
  .top-app-bar strong {
    margin: 0;
  }

  .top-app-bar p {
    color: var(--mb-color-on-surface-variant);
    font-size: 0.75rem;
    line-height: 1.2;
  }

  .top-app-bar strong {
    display: block;
    font-size: 1.25rem;
    line-height: 1.2;
    font-weight: 650;
  }

  .top-app-bar__meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    color: var(--mb-color-on-surface-variant);
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .top-app-bar__meta > span {
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid color-mix(in srgb, var(--mb-color-outline-variant) 60%, transparent);
    border-radius: var(--mb-shape-full);
    padding: 0 12px;
    color: var(--mb-color-on-surface-variant);
    background: var(--mb-color-surface-container);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .locale-switch {
    min-height: 38px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid color-mix(in srgb, var(--mb-color-outline-variant) 60%, transparent);
    border-radius: var(--mb-button-shape);
    padding: 3px;
    background: var(--mb-color-surface-container);
  }

  .locale-switch > span {
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    padding: 0 7px;
    color: var(--mb-color-on-surface-variant);
    font-size: 0.75rem;
    font-weight: 700;
  }

  .locale-switch__button {
    min-width: 36px;
    min-height: 30px;
    --md-filled-button-container-height: 30px;
    --md-filled-button-container-shape: var(--mb-button-shape);
    --md-filled-button-label-text-size: 0.75rem;
    --md-filled-button-label-text-weight: 700;
    --md-filled-button-leading-space: 10px;
    --md-filled-button-trailing-space: 10px;
    --md-outlined-button-container-height: 30px;
    --md-outlined-button-container-shape: var(--mb-button-shape);
    --md-outlined-button-label-text-size: 0.75rem;
    --md-outlined-button-label-text-weight: 700;
    --md-outlined-button-leading-space: 10px;
    --md-outlined-button-trailing-space: 10px;
  }

  md-filled-button {
    --md-filled-button-container-color: var(--mb-color-primary);
    --md-filled-button-label-text-color: var(--mb-color-on-primary);
    --md-filled-button-hover-label-text-color: var(--mb-color-on-primary);
    --md-filled-button-focus-label-text-color: var(--mb-color-on-primary);
    --md-filled-button-pressed-label-text-color: var(--mb-color-on-primary);
    --md-filled-button-icon-color: var(--mb-color-on-primary);
    --md-filled-button-hover-icon-color: var(--mb-color-on-primary);
    --md-filled-button-focus-icon-color: var(--mb-color-on-primary);
    --md-filled-button-pressed-icon-color: var(--mb-color-on-primary);
    --md-filled-button-container-shape: var(--mb-button-shape);
  }

  md-outlined-button {
    --md-outlined-button-container-shape: var(--mb-button-shape);
    --md-outlined-button-label-text-color: var(--mb-color-on-surface);
    --md-outlined-button-outline-color: var(--mb-color-outline-variant);
    --md-outlined-button-hover-label-text-color: var(--mb-color-primary);
    --md-outlined-button-hover-outline-color: var(--mb-color-primary);
  }

  .secondary-button {
    --md-outlined-button-label-text-color: var(--mb-color-on-surface);
    --md-outlined-button-outline-color: var(--mb-color-outline-variant);
  }

  md-icon-button {
    --md-icon-button-icon-color: var(--mb-color-on-surface);
    --md-icon-button-hover-icon-color: var(--mb-color-primary);
    --md-icon-button-pressed-icon-color: var(--mb-color-primary);
  }

  md-switch {
    --md-switch-selected-track-color: var(--mb-color-primary);
    --md-switch-selected-hover-track-color: var(--mb-color-primary);
    --md-switch-selected-focus-track-color: var(--mb-color-primary);
    --md-switch-selected-pressed-track-color: var(--mb-color-primary);
    --md-switch-selected-handle-color: var(--mb-color-on-primary);
    --md-switch-track-color: var(--mb-color-surface-container-highest);
    --md-switch-hover-track-color: var(--mb-color-surface-container-highest);
    --md-switch-focus-track-color: var(--mb-color-surface-container-highest);
    --md-switch-pressed-track-color: var(--mb-color-surface-container-highest);
    --md-switch-track-outline-color: var(--mb-color-outline);
    --md-switch-hover-track-outline-color: var(--mb-color-outline);
    --md-switch-focus-track-outline-color: var(--mb-color-outline);
    --md-switch-pressed-track-outline-color: var(--mb-color-outline);
    --md-switch-handle-color: var(--mb-color-outline);
    --md-switch-hover-handle-color: var(--mb-color-on-surface-variant);
    --md-switch-focus-handle-color: var(--mb-color-on-surface-variant);
    --md-switch-pressed-handle-color: var(--mb-color-on-surface-variant);
    --md-switch-selected-hover-state-layer-color: var(--mb-color-primary);
    --md-switch-selected-pressed-state-layer-color: var(--mb-color-primary);
    --md-switch-hover-state-layer-color: var(--mb-color-on-surface);
    --md-switch-pressed-state-layer-color: var(--mb-color-on-surface);
  }

`;
