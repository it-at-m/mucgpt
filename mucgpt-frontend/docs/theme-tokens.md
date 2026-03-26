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
- `status/*`

This keeps product decisions readable and stable, while still allowing Fluent UI components to inherit the correct visuals.

## Current Semantic Tokens

### Header

- `headerBackground`: app header and footer background
- `headerHover`: hover state for header buttons and controls
- `headerPressed`: pressed state for header buttons and controls
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

### Text

- `textDefault`: main body text and headings
- `textSecondary`: descriptions and metadata
- `textTertiary`: placeholders and low-emphasis text
- `textOnHeader`: text and icons on the header
- `textOnPrimary`: text and icons on primary backgrounds

### Outline

- `outlineSubtle`: quiet dividers and card borders
- `outlineBase`: standard borders
- `outlineHover`: hover, active and high-emphasis borders

### Focus

- `focusRing`: visible keyboard focus indicator

### Disabled

- `disabledBackground`: background for disabled controls
- `disabledForeground`: text and icon color for disabled controls
- `disabledBorder`: border color for disabled controls

### Status

- `statusSuccessBackground`: success banners, alerts and toast backgrounds
- `statusSuccessBorder`: success borders and separators
- `statusSuccessForeground`: success text and icons
- `statusWarningBackground`: warning banners, alerts and toast backgrounds
- `statusWarningBorder`: warning borders and separators
- `statusWarningForeground`: warning text and icons
- `statusErrorBackground`: error banners, alerts and destructive feedback backgrounds
- `statusErrorBorder`: error borders and separators
- `statusErrorForeground`: error text and icons
- `statusInfoBackground`: informational banners and neutral notices
- `statusInfoBorder`: info borders and separators
- `statusInfoForeground`: info text and icons

## Fluent Mapping

The semantic tokens are mapped to Fluent aliases in `LayoutHelper.tsx`. The most important mappings are:

- `surfaceBase -> colorNeutralBackground1`
- `surfaceSubtle -> colorNeutralBackground2`
- `surfaceRaised -> colorNeutralBackground3`
- `primaryBase -> colorBrandBackground`
- `primaryHover -> colorBrandBackgroundHover`
- `primaryPressed -> colorBrandBackgroundPressed`
- `primarySubtle -> colorBrandBackground2`
- `textDefault -> colorNeutralForeground1`
- `textSecondary -> colorNeutralForeground2`
- `textTertiary -> colorNeutralForeground3`
- `outlineBase -> colorNeutralStroke1`
- `outlineSubtle -> colorNeutralStroke2`
- `outlineHover -> colorNeutralStrokeAccessible`
- `focusRing -> colorStrokeFocus2`
- `disabled* -> neutral disabled aliases`
- `statusSuccess* -> colorStatusSuccess*`
- `statusWarning* -> colorStatusWarning*`
- `statusError* -> colorStatusDanger*`

## CSS Usage

Prefer the semantic CSS custom properties:

- `--theme-header-background`
- `--theme-header-pressed`
- `--theme-surface-base`
- `--theme-surface-raised`
- `--theme-surface-subtle`
- `--theme-primary-base`
- `--theme-primary-hover`
- `--theme-primary-pressed`
- `--theme-primary-subtle`
- `--theme-primary-strong`
- `--theme-text-default`
- `--theme-text-secondary`
- `--theme-text-tertiary`
- `--theme-outline-base`
- `--theme-outline-subtle`
- `--theme-outline-hover`
- `--theme-focus-ring`
- `--theme-disabled-background`
- `--theme-disabled-foreground`
- `--theme-disabled-border`
- `--theme-status-success-background`
- `--theme-status-success-border`
- `--theme-status-success-foreground`
- `--theme-status-warning-background`
- `--theme-status-warning-border`
- `--theme-status-warning-foreground`
- `--theme-status-error-background`
- `--theme-status-error-border`
- `--theme-status-error-foreground`
- `--theme-status-info-background`
- `--theme-status-info-border`
- `--theme-status-info-foreground`

Legacy aliases such as `--primary`, `--surface` or `--primaryContainer` still exist temporarily for compatibility with older CSS modules. New code should not introduce those names.

## Guidelines

- Do not use `primaryBase` as a large page background.
- Prefer `surfaceRaised` for cards and input containers.
- Use `primarySubtle` for selected states before reaching for stronger fills.
- Keep `focusRing` distinct from hover; focus exists for keyboard and accessibility states.
- Use `disabled*` tokens for disabled components instead of low-opacity hacks where possible.
- Prefer status tokens over ad hoc red, yellow, green and blue values in components.
- If a new token is needed, add it semantically first, then map it to Fluent.
