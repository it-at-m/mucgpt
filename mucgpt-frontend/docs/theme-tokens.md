# Theme Tokens

MUCGPT uses semantic app tokens as the source of truth for theming. These tokens are then mapped to Fluent UI theme aliases so Fluent components such as `Button`, `Input`, `Tab` and `Dialog` render consistently with the rest of the app.

## Files

- `src/pages/layout/themeTokens.ts`
  Contains the light and dark semantic token sets.
- `src/pages/layout/LayoutHelper.tsx`
  Maps semantic tokens to Fluent UI theme aliases and exposes CSS custom properties.

## Token Strategy

Do not design against raw Fluent token names first. Design against semantic roles:

- `header/*`
- `surface/*`
- `primary/*`
- `text/*`
- `outline/*`
- `focus/*`

This keeps product decisions readable and stable, while still allowing Fluent UI components to inherit the correct visuals.

## Current Semantic Tokens

### Header

- `headerBackground`: app header and footer background
- `headerHover`: hover state for header buttons and controls
- `headerSubtle`: subtle header-adjacent surfaces such as pills or lightweight menus

### Surface

- `surfaceBase`: page background
- `surfaceRaised`: cards, dialogs, inputs, drawers
- `surfaceSubtle`: softly separated sections, hero areas, sidebars

### Primary

- `primaryBase`: default primary action background
- `primaryHover`: hover state for primary actions
- `primaryPressed`: pressed state for primary actions
- `primarySubtle`: selected chips, active tabs, soft brand highlights
- `primaryStrong`: stronger brand accent for emphasis
- `primaryOn`: text and icons on primary-colored backgrounds

### Text

- `textPrimary`: main body text and headings
- `textSecondary`: descriptions and metadata
- `textTertiary`: placeholders and low-emphasis text
- `textOnHeader`: text and icons on the header
- `textOnPrimary`: text and icons on primary backgrounds

### Outline

- `outlineSubtle`: quiet dividers and card borders
- `outlineBase`: standard borders
- `outlineStrong`: active or high-emphasis borders

### Focus

- `focusRing`: visible keyboard focus indicator

## Fluent Mapping

The semantic tokens are mapped to Fluent aliases in `LayoutHelper.tsx`. The most important mappings are:

- `surfaceBase -> colorNeutralBackground1`
- `surfaceSubtle -> colorNeutralBackground2`
- `surfaceRaised -> colorNeutralBackground3`
- `primaryBase -> colorBrandBackground`
- `primaryHover -> colorBrandBackgroundHover`
- `primaryPressed -> colorBrandBackgroundPressed`
- `primarySubtle -> colorBrandBackground2`
- `textPrimary -> colorNeutralForeground1`
- `textSecondary -> colorNeutralForeground2`
- `textTertiary -> colorNeutralForeground3`
- `outlineBase -> colorNeutralStroke1`
- `outlineSubtle -> colorNeutralStroke2`
- `focusRing -> colorStrokeFocus2`

## CSS Usage

Prefer the semantic CSS custom properties:

- `--theme-header-background`
- `--theme-surface-base`
- `--theme-surface-raised`
- `--theme-surface-subtle`
- `--theme-primary-base`
- `--theme-primary-hover`
- `--theme-primary-pressed`
- `--theme-primary-subtle`
- `--theme-primary-strong`
- `--theme-text-primary`
- `--theme-text-secondary`
- `--theme-text-tertiary`
- `--theme-outline-base`
- `--theme-outline-subtle`
- `--theme-outline-strong`
- `--theme-focus-ring`

Legacy aliases such as `--primary`, `--surface` or `--primaryContainer` still exist temporarily for compatibility with older CSS modules. New code should not introduce those names.

## Guidelines

- Do not use `primaryBase` as a large page background.
- Prefer `surfaceRaised` for cards and input containers.
- Use `primarySubtle` for selected states before reaching for stronger fills.
- Keep `focusRing` distinct from hover; focus exists for keyboard and accessibility states.
- If a new token is needed, add it semantically first, then map it to Fluent.
