# MUCGPT Frontend Instructions

These instructions are mandatory for all changes inside `mucgpt-frontend`.

## Scoped instructions

When working inside `mucgpt-frontend`, also follow:
`mucgpt-frontend/AGENTS.md`

For every UI or styling change, read and follow the repository root
`DESIGN.md`. It is the source of truth for MUCGPT product design,
styling, theming, and interaction patterns.

## Architecture

MUCGPT uses React, TypeScript, Fluent UI v9 and CSS Modules.

Fluent UI is the technical component foundation.
The MUCGPT design system defines the visual language.

Dependency direction:

```text
pages / features
    ↓
shared MUCGPT UI (`src/ui`)
    ↓
Fluent UI
```

Shared UI code MUST NOT depend on pages or feature-specific code.

## Before implementing UI

Before creating a component or adding styling:

1. Search the repository for an existing equivalent component or pattern.
2. Check `src/ui` for an existing MUCGPT primitive.
3. Check whether Fluent UI can express the requirement through its public API.
4. Check the existing theme and design tokens.
5. Only then introduce feature-specific styling.

Prefer extending an existing shared pattern over creating a local variation.

## Implementation order

Use this order when implementing UI:

1. Existing MUCGPT component or product pattern.
2. Fluent UI component using its public API.
3. Fluent theme or existing semantic token.
4. Shared MUCGPT primitive or semantic token when the requirement is genuinely reusable.
5. Feature-specific CSS only when the requirement is genuinely local.

Do not solve application-wide design requirements with local CSS overrides.

## Fluent UI

Prefer Fluent component props, appearances, slots and public APIs.

Do not target Fluent implementation details.

Forbidden:

* `.fui-*` selectors
* private Fluent custom properties or data attributes
* selectors depending on Fluent's internal DOM
* overriding Fluent internal pseudo-elements
* specificity hacks such as `.card.card`
* `!important`
* `transition: all`
* locally recreating standard Fluent interaction behavior when it can be expressed centrally

If Fluent requires a specificity hack to achieve the desired result,
reconsider the implementation before adding the override.

## Design tokens

Use Fluent semantic tokens whenever an appropriate token exists.

Use MUCGPT app tokens only for documented product semantics that Fluent
cannot express appropriately.

Tokens MUST be used according to their semantic purpose.

Do not:

* introduce raw color values in feature code
* use arbitrary typography or radii when a Fluent token fits
* use unrelated tokens merely because their current value looks correct
* create an app token for a one-off feature requirement

Follow the token ownership rules in `DESIGN.md` and
`docs/theme-tokens.md`.

## Structural values

Raw values are allowed when they represent intentional structural constraints,
for example breakpoints, navigation widths, content widths or intrinsic sizes.

Do not introduce arbitrary values simply to make something look right.

If the same structural value is repeated across multiple components,
promote it to an appropriate shared semantic value.

## CSS Modules

Use CSS Modules for feature layout, responsive composition and visuals that
cannot reasonably be expressed through Fluent.

Prefer Flexbox and CSS Grid for normal layout.

Avoid absolute positioning for normal document flow.
Use it only where the element is genuinely overlaid or floating.

## Shared UI

Application-wide behavior belongs in `src/ui`, not in feature CSS.

Create or extend a shared primitive when MUCGPT has a consistent semantic
variation that Fluent does not provide.

Do not wrap every Fluent component automatically.
A shared wrapper must solve a concrete application-wide requirement.

## Component ownership

Components own their internal visual implementation.

Do not pass CSS classes from parents solely to style private child internals.

Do not place feature-specific components in `src/ui`.
Do not place application-wide UI primitives inside feature directories.

## Design-system changes

Do not silently introduce local exceptions to `DESIGN.md`.

If a requirement appears to conflict with the design system, reconsider the
implementation first.

If MUCGPT genuinely requires a new reusable visual rule, component pattern or
semantic token, implement it at the appropriate shared layer and keep the
design-system documentation consistent.

## Accessibility

Interactive UI must remain keyboard accessible and semantically correct.

Preserve:

* keyboard operation
* logical focus order
* visible focus indicators
* correct native or ARIA semantics
* accessible names
* disabled behavior
* reduced-motion behavior where applicable

Do not turn non-interactive elements into controls through styling alone.

## Before finishing

For frontend changes:

* run `npm run lint`
* run relevant tests when available
* verify that existing Fluent/MUCGPT patterns were reused where appropriate
* verify that no forbidden Fluent overrides or specificity hacks were added
* verify light and dark themes for visual changes
* verify keyboard and focus behavior for interactive changes

If one of these checks fails, reconsider the implementation before finishing.
