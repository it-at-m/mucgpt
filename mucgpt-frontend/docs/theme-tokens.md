# Theme Tokens

MUCGPT builds its Fluent UI v9 theme from the MUCGPT color palettes, not from a manually-mapped app token layer.

## Files

- `src/ui/theme/palette.ts`
  Reusable primitive color ramps (`mucgptBrandRamp`, `neutralRamp`, `successRamp`, `warningRamp`, `dangerRamp`, `infoRamp`). It is the source of shared palette values, but not necessarily every isolated color literal in the theme layer.
- `src/ui/theme/fluentTheme.ts`
  `createMucgptTheme(isLight)` builds the Fluent light/dark theme from the palettes (brand ramp, neutral/status overrides, global radius scale). `createScaledTypographyTheme(theme, scaling)` applies the user's font-scaling setting on top.
- `src/ui/theme/appTokens.ts`
  A small set of product-specific semantics Fluent has no equivalent for (see below), exposed as `--app-*` CSS custom properties. An app token may own deliberate light/dark values directly when they are not a reusable palette, or reference `palette.ts` when the value is shared.
- `src/pages/layout/Layout.tsx`
  Builds the theme and CSS vars and passes them into `FluentProvider` / `document.documentElement`.

## Mental Model

```
palette.ts -> fluentTheme.ts -> createMucgptTheme(isLight) -> createScaledTypographyTheme(...) -> FluentProvider
```

Use this order when styling:

1. Use Fluent CSS vars directly, e.g. `var(--colorNeutralBackground1)`, `var(--colorBrandBackground)`.
2. Only reach for `--app-*` when Fluent has no clean equivalent (see `appTokens.ts`).
3. If a new product semantic is needed, add it to `appTokens.ts` and keep raw values inside the theme layer. Feature code must not consume palette primitives or introduce raw colors.

## Neutral Surfaces

Use Fluent's neutral backgrounds as one shared elevation hierarchy in both themes:

- `Background3`: deepest application surface and page canvas.
- `Background2`: secondary or grouped neutral surface, such as the sidebar.
- `Background1`: normal raised surface and generic card level.

Generic cards use Fluent neutral backgrounds. Do not add app-specific card or standard-surface colors unless a reusable MUCGPT product semantic requires one.

## Remaining App Tokens

These have no Fluent equivalent and are exposed as `--app-*`:

- `--app-user-message-background` - user chat bubble background
- `--app-assistant-config-surface` / `-hover` / `-editing` - assistant config field surface states
- `--app-assistant-config-border` / `-hover` - assistant config field border states
- `--app-status-info-border` - info accent (Fluent has no `colorStatusInfo*` family); sourced from `infoRamp`
- `--app-radius-xsmall` (2px) / `--app-radius-xxlarge` (24px) - asymmetric chat-bubble corner radii, not part of Fluent's radius scale

`--app-primary-subtle-foreground` is a temporary compatibility alias for the existing Discovery Card and resolves to `--colorBrandForeground2`. It can be removed with the Discovery Card design-system update.

## Fluent Radius Scale

`fluentTheme.ts` sets Fluent's global radius scale app-wide:

- `borderRadiusSmall: 6px`
- `borderRadiusMedium: 10px`
- `borderRadiusLarge: 12px`
- `borderRadiusXLarge: 16px`

## Fluent Palette Aliases

Some Fluent components internally consume `--colorPaletteRed*`, `--colorPaletteGreen*`, and `--colorPaletteYellow*` rather than `--colorStatus*`. `fluentTheme.ts` aliases those Fluent palette tokens to the corresponding MUCGPT status mappings, so Fluent internals and semantic feature styles render the same status palette. Feature code should nevertheless use `--colorStatus*` for success, warning, and danger semantics.
