# Theme Tokens

MUCGPT uses semantic app tokens from `src/pages/layout/themeTokens.ts` as the source of truth.  
`src/pages/layout/LayoutHelper.tsx` maps those app tokens to Fluent UI v9 theme tokens.

## Files

- `src/pages/layout/themeTokens.ts`
  Defines the semantic light and dark token sets.
- `src/pages/layout/LayoutHelper.tsx`
  Creates the Fluent theme and exposes the remaining `--app-*` CSS variables.
- `src/pages/layout/Layout.tsx`
  Passes the Fluent theme and `--app-*` vars into `FluentProvider`.

## Mental Model

Use this order when styling:

1. Define product semantics in `themeTokens.ts`
2. Map them to Fluent tokens in `LayoutHelper.tsx`
3. Use Fluent CSS vars directly in CSS, for example `var(--colorNeutralBackground1)`
4. Use `--app-*` only where Fluent has no clean equivalent

## Current App Tokens

### Header

- `headerBackground`
- `headerHover`
- `headerPressed`

### Surfaces

- `surfaceBase`
- `surfaceRaised`
- `surfaceSubtle`

### Primary

- `primaryBase`
- `primaryHover`
- `primaryPressed`
- `primarySubtle`
- `primarySubtleOn`
- `primaryStrong`

### Text

- `textDefault`
- `textSecondary`
- `textTertiary`
- `textOnHeader`
- `textOnPrimary`

### Outline / Focus / Disabled

- `outlineSubtle`
- `outlineBase`
- `outlineHover`
- `focusRing`
- `disabledBackground`
- `disabledForeground`
- `disabledBorder`

### Status

- `statusSuccessBackground`
- `statusSuccessBorder`
- `statusSuccessForeground`
- `statusWarningBackground`
- `statusWarningBorder`
- `statusWarningForeground`
- `statusErrorBackground`
- `statusErrorBorder`
- `statusErrorForeground`
- `statusInfoBackground`
- `statusInfoBorder`
- `statusInfoForeground`

## Fluent Mapping Reference

This is the current intended mapping from app tokens to Fluent v9 tokens.

### Surfaces

- `surfaceBase -> colorNeutralBackground1`
- `surfaceRaised -> colorNeutralBackground2`
- `surfaceSubtle -> colorNeutralBackground3`
- `surfaceRaised -> colorNeutralCardBackground`
- `disabledBackground -> colorNeutralBackgroundDisabled`

### Primary / Brand

- `primaryBase -> colorBrandBackground`
- `primaryHover -> colorBrandBackgroundHover`
- `primaryPressed -> colorBrandBackgroundPressed`
- `primarySubtle -> colorBrandBackground2`
- `primaryStrong -> colorBrandForeground1`
- `primaryStrong -> colorBrandStroke1`
- `primaryStrong -> colorBrandForegroundLink`
- `primarySubtleOn -> colorBrandForeground2`
- `textOnPrimary -> colorNeutralForegroundOnBrand`

### Text

- `textDefault -> colorNeutralForeground1`
- `textSecondary -> colorNeutralForeground2`
- `textTertiary -> colorNeutralForeground3`
- `disabledForeground -> colorNeutralForegroundDisabled`

### Outline / Focus / Disabled

- `outlineBase -> colorNeutralStroke1`
- `outlineHover -> colorNeutralStroke1Hover`
- `outlineSubtle -> colorNeutralStroke2`
- `disabledBorder -> colorNeutralStrokeDisabled`
- `focusRing -> colorStrokeFocus2`

### Status

- `statusSuccessBackground -> colorStatusSuccessBackground1`
- `statusSuccessBorder -> colorStatusSuccessBorder1`
- `statusSuccessForeground -> colorStatusSuccessForeground1`
- `statusWarningBackground -> colorStatusWarningBackground1`
- `statusWarningBorder -> colorStatusWarningBorder1`
- `statusWarningForeground -> colorStatusWarningForeground1`
- `statusErrorBackground -> colorStatusDangerBackground1`
- `statusErrorBorder -> colorStatusDangerBorder1`
- `statusErrorForeground -> colorStatusDangerForeground1`

## Remaining Custom CSS Variables

These values intentionally remain outside Fluent and are exposed as `--app-*`:

- `headerBackground -> --app-header-background`
- `headerHover -> --app-header-hover`
- `headerPressed -> --app-header-pressed`
- `textOnHeader -> --app-header-foreground`
- `primarySubtleOn -> --app-primary-subtle-foreground`
- `statusInfoBackground -> --app-status-info-background`
- `statusInfoBorder -> --app-status-info-border`
- `statusInfoForeground -> --app-status-info-foreground`

## CSS Usage

Prefer Fluent CSS variables directly:

- `var(--colorNeutralBackground1)`
- `var(--colorNeutralBackground2)`
- `var(--colorNeutralBackground3)`
- `var(--colorBrandBackground)`
- `var(--colorBrandBackground2)`
- `var(--colorNeutralForeground1)`
- `var(--colorNeutralForeground2)`
- `var(--colorNeutralStroke1)`
- `var(--colorStatusSuccessBackground1)`

Use `--app-*` only for the remaining custom semantics listed above.

## Practical Rules

- Do not introduce raw hex colors into app CSS or components.
- Do not introduce alias layers like `--surface`, `--primary`, or `--theme-*`.
- If a new product semantic is needed, add it in `themeTokens.ts` first.
- If Fluent already has a matching token, map to it and consume it directly.
- Only add a new `--app-*` token when Fluent does not model the semantic cleanly.
