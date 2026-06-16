# Webui Material Component Debt

This document tracks webui controls that violate the workspace rule: common controls must use official Material Web components from `@material/web` unless the user explicitly approves a custom control for that specific case.

## Migration Order

1. `SelectMenu` - migrated
2. `AuthGate` - migrated
3. `SchemaField` - migrated
4. `CreateResourcePanel` - migrated
5. `LogPanel` and `OverviewPage` - migrated
6. `RpcTestPage` - migrated
7. `ModelsProvidersPage` - migrated
8. `ResourceEditorCard` - migrated
9. `AppShell` locale and theme controls - migrated

## Debt Inventory

| Order | Component | Location | Previous custom control | Current state | Visual verification |
| --- | --- | --- | --- | --- | --- |
| 1 | `SelectMenu` | `webui/src/features/configGraph/SelectMenu.tsx` | Handwritten combobox/listbox/option with local keyboard handling | Uses shared `MaterialSelect` wrapper around `md-outlined-select` and `md-select-option` | Compare config editor select fields on desktop and mobile; no major width, density, popover, or label drift |
| 2 | `AuthGate` | `webui/src/components/AuthGate.tsx` | Native password input, custom checkbox, custom submit button | Uses Material text field, checkbox, and button wrappers | Verify auth card keeps existing hierarchy and spacing; checkbox and submit button must not dominate the card |
| 3 | `SchemaField` | `webui/src/features/configGraph/SchemaField.tsx` | Custom outlined text field, textarea, JSON summary button, help icon button/tooltip | Uses Material text fields, outlined buttons, icon buttons, switch, and select wrappers | Verify resource editor fields across text, secret, number, textarea, object, array, and switch examples |
| 4 | `CreateResourcePanel` | `webui/src/features/configGraph/CreateResourcePanel.tsx` | Custom buttons, text inputs, option groups, presets, help buttons | Uses Material buttons, icon buttons, text fields, selects, chips, and switch wrappers | Verify create provider/model/route/extension forms on desktop and mobile; no major grid or density drift |
| 5 | `LogPanel` | `webui/src/features/logs/LogPanel.tsx` | Custom segmented controls, log level filter, action buttons, search field | Uses Material chips, outlined buttons, icon button, and text field wrappers | Verify logs toolbar remains compact and scannable in embedded overview and logs page contexts |
| 5 | `OverviewPage` | `webui/src/features/overview/OverviewPage.tsx` | Custom usage range segmented control | Uses Material filter chips in `md-chip-set` | Verify usage dashboard header remains balanced and does not wrap awkwardly on mobile |
| 6 | `RpcTestPage` | `webui/src/features/rpcTest/RpcTestPage.tsx` | Native select, textarea, number inputs, submit button | Uses Material select, text fields, and filled button wrappers | Verify smoke-test form remains simple and does not regress JSON response readability |
| 7 | `ModelsProvidersPage` | `webui/src/features/modelProviders/ModelsProvidersPage.tsx` | Custom provider-offers expand button | Uses shared `MaterialIconButton` wrapper | Verify provider offers disclosure alignment and animation do not drift |
| 8 | `ResourceEditorCard` | `webui/src/features/configGraph/ResourceEditorCard.tsx` | Custom delete, confirm, and cancel buttons | Uses shared Material filled and outlined button wrappers | Verify delete confirmation remains inline and compact |
| 9 | `AppShell` | `webui/src/app/App.tsx` | Custom locale buttons and direct icon button bridge | Uses shared Material filled, outlined, and icon button wrappers | Verify app bar remains compact on desktop and wraps cleanly on mobile |

## Current Exceptions

- `md-chip-set` containers appear directly in page components because they are official Material Web grouping elements and do not need React property bridging.
- Navigation rail links remain `NavLink` anchors, not button controls. They may use `md-icon` and `md-ripple` for Material affordance, but they are route links rather than button replacements.
- Layout classes such as `.secondary-button` and `.fab-button` may be applied to Material Web host elements only. They must not be used to restyle native `<button>` elements.

## Review Requirements

- Tests must render actual UI and assert official Material Web elements are used for migrated controls.
- Tests should query `md-*` custom elements directly when jsdom Testing Library does not expose Material Web shadow-DOM roles.
- A custom control may remain only with explicit user approval and an inline or debt-document note explaining why Material Web is insufficient.
- Evidence for outlined text-field/select migrations must verify official Material API usage, not just host-element presence: non-empty Material label, no replacement external label, slotted text-field icons, built-in select trailing affordance, and intentional `spellcheck` serialization.
- Visual verification must include browser-rendered screenshots for pages touched by each migration. Major visual drift means the task is not complete even if tests pass.
- Visual verification for outlined fields/selects must include browser-rendered empty, focused, filled, and error or help-icon states where applicable. Select evidence must include closed and opened states.
- Store screenshot and report evidence under `docs/superpowers/reports/` unless the user explicitly asks to commit evidence artifacts.
- Do not style Material Web internals or shadow DOM classes. Use public CSS custom properties and wrapper layout only.
- Do not add fallback markup that recreates the replaced custom control.
