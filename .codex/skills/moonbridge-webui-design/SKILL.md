---
name: moonbridge-webui-design
description: Moon Bridge webui design and component rules. Use whenever changing files under webui/src that affect UI structure, controls, styling, theme tokens, layouts, or interaction behavior.
---

# Moon Bridge Webui Design

## Core Rule

Prefer official Material Web components from `@material/web` for all common controls.

Do not hand-roll controls such as switches, buttons, icon buttons, checkboxes, radio buttons, menus, tabs, dialogs, sliders, text fields, or progress indicators unless the user explicitly approves a custom control for that specific case. If a custom control is approved, document why Material Web is insufficient and keep the custom surface isolated.

Before changing webui UI, read `docs/webui/material-component-debt.md` when it exists. Treat it as the ordered migration backlog for known violations.

Native `<button>`, `<input>`, `<select>`, and `<textarea>` elements are not acceptable for app controls under `webui/src` unless they are inside tests, non-interactive generated examples, or an explicitly approved exception. Route links may remain anchors when they are navigation, not button controls.

## Existing Stack

- React renders Material Web custom elements with `createElement(...)` or a small typed wrapper component.
- Material Web imports belong near the component/wrapper that uses the element, for example `@material/web/switch/switch.js`.
- Theme integration should use Material Web public CSS custom properties such as `--md-switch-selected-track-color`; do not style internal shadow DOM classes.
- Project theme tokens live under `webui/src/theme/` and app CSS chunks live under `webui/src/app/styles/`.

## Component Practice

- Use a wrapper when React needs to bridge custom-element properties or events, especially boolean properties such as `selected` and events such as `change`.
- Prefer existing wrappers in `webui/src/components/Material*.tsx` before adding direct `md-*` elements in feature code. Direct `md-chip-set`, `md-icon`, and `md-ripple` use is acceptable when no property/event bridge is needed and the element is an official Material Web primitive.
- Boolean ARIA attributes on Material custom elements must be serialized intentionally when tests or accessibility depend on exact string values, for example `aria-expanded="true"` and `aria-pressed="false"`.
- Wrapper components must fail fast for impossible setup states. Do not add fallback markup that recreates the control.
- Keep wrappers narrow: map props to the official element and expose only app-needed behavior.
- Remove obsolete handcrafted CSS selectors when replacing custom controls. Styling classes may target Material Web host elements for layout or public CSS custom properties only; they must not keep styling native control implementations alive.

### Outlined Text Fields And Selects

`md-outlined-text-field` and `md-outlined-select` are not correctly migrated merely because the official host element is present. The Material component must own the whole visible field surface.

- The Material element must own the visible field label through a non-empty `label` property or attribute. Do not pass `label=""` while rendering an adjacent custom visual label for an ordinary visible form field.
- Text field leading and trailing icons must be slotted children of `md-outlined-text-field` using `slot="leading-icon"` or `slot="trailing-icon"`. Do not render external icons, help buttons, clear buttons, or manually aligned wrappers beside the field when they visually belong inside the field.
- `md-outlined-select` must use its official floating label and built-in trailing affordance. Do not add a custom external caret, trailing icon, or overlay button for the select.
- Wrapper APIs must expose app-needed Material properties directly, including `label`, `value`, `type`, `supportingText`, `errorText`, `disabled`, `required`, and `spellCheck`. Bridge both custom-element properties and host attributes when tests, accessibility, or browser behavior depend on exact serialization.
- Text fields must serialize `spellcheck` intentionally. Configuration identifiers, URLs, secrets, JSON, search filters, numeric fields, and other non-prose fields should default to `spellcheck="false"`; natural-language prose fields may opt in explicitly.
- Do not recreate Material label, outline notch, icon spacing, trailing affordance, focus, filled, or error animations in app CSS. Use Material host layout and public CSS custom properties only.

## Verification

For UI control changes:

1. Add or update tests that render the actual UI and assert the official element is used.
2. Cover the interaction path that changes app state.
3. Run targeted tests first, then `npm run build`, `npm test`, and `git diff --check` from `webui` or repo root as appropriate.
4. For visual changes, use browser or screenshot verification when the risk is layout/spacing drift.

Visual verification is required for migrated controls. Use browser-rendered screenshots or an equivalent visual inspection path for each touched page/state. Passing tests alone is not enough when control geometry, density, or popover behavior changed. Treat major visual drift as a failed task.

## Reviewer Agent Requirements

When acting as a reviewer agent for Moon Bridge webui changes, enforce this skill strictly:

- Block approval if a common control is still hand-rolled and there is no explicit user-approved exception recorded in code or in `docs/webui/material-component-debt.md`.
- Block approval if `webui/src` production code introduces native `<button>`, `<input>`, `<select>`, or `<textarea>` controls without an explicit approved exception.
- Block approval if feature code directly creates `md-*` controls that should go through an existing Material wrapper, unless the direct element is a simple official grouping/decorative primitive such as `md-chip-set`, `md-icon`, or `md-ripple`.
- Block approval if a Material Web replacement includes fallback markup that recreates the old custom control.
- Block approval if an outlined text field or select renders `md-outlined-*` but still uses an external custom label as the visible field label, including `label=""` plus adjacent label markup for a normal visible form field.
- Block approval if text-field icons, help icons, clear buttons, or trailing actions that visually belong to the field are rendered outside `md-outlined-text-field` instead of using official slots.
- Block approval if an outlined select adds a custom external trailing icon, caret, or overlay control instead of relying on the Material select affordance.
- Block approval if code styles Material Web shadow DOM internals or private classes instead of public CSS custom properties.
- Block approval if tests do not assert that the migrated official Material Web element is rendered.
- Block approval if interaction tests do not cover the migrated control's state-change path.
- Block approval if tests only assert that `md-outlined-text-field` or `md-outlined-select` exists without checking correct Material API use: non-empty `label`, slotted icons where applicable, intentional `spellcheck`, and absence of replacement external label or icon markup.
- Block approval if CSS manually rebuilds label position, outline notch behavior, icon alignment, trailing affordances, or focus/error animations for Material outlined fields/selects.
- Block approval if visual verification is missing for changed pages or if screenshots show major layout, density, alignment, or overflow drift.
- Review obsolete CSS selectors as code debt: if a selector only exists for a removed handwritten control, require its removal or a documented follow-up.
- Check staged files and diffs directly. Do not rely on implementer summaries.
