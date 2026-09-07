---
name: MUCGPT
description: A modern municipal AI assistant platform centered on reusable workflow-specific assistants.
register: product
---

# MUCGPT Design System

This document is the single source of truth for MUCGPT product design and frontend styling. It defines the intended visual language, interaction principles, reusable product patterns, and the contract between Fluent UI and MUCGPT-specific styling.

MUCGPT uses Fluent UI as its component foundation. The design system extends Fluent only where the product needs a distinct semantic concept.

## 1. Product direction

### Creative north star: The Municipal Assistant Workbench

MUCGPT should feel like a precise, modern workbench for municipal AI work. It is not a decorative AI demo, a generic chatbot, or a heavy administration console. The interface helps employees find, understand, create, and use assistants with confidence.

The product has two visible layers:

- **Assistants are reusable work objects.** They carry purpose, ownership, scope, instructions, tools, and trust signals.
- **Chat is the execution surface.** It is where work happens, but it must preserve the context of the active assistant.

The interface should feel calm, capable, approachable, and current. It should reduce uncertainty for first-time AI users while giving experienced users sufficient speed, detail, and control.

### Design principles

1. **Assistants are the product.** Discovery, creation, configuration, sharing, and reuse receive more design emphasis than generic chat chrome.
2. **Clarity before novelty.** Users should understand the next action without reading long explanations.
3. **Confidence through transparency.** Show purpose, ownership, visibility, tools, and relevant configuration before asking users to rely on an assistant.
4. **Workflow before model mechanics.** Describe the user's work before exposing technical AI terminology.
5. **Progressive detail.** Show the useful summary first and reveal prompts, tools, examples, and advanced settings when needed.
6. **Human in the loop.** MUCGPT helps people think, write, inspect, and decide. It must not imply unrestricted autonomous execution.
7. **Earned density.** Dense screens are acceptable when the task requires them, but density must be structured through hierarchy and grouping.
8. **Municipal clarity, modern quality.** The product should feel dependable and accessible without looking bureaucratic or dated.
9. **Open-source adaptability.** Core patterns and language should work beyond a single deployment or organization.

### Visual character

- Restrained civic blue on cool, tinted neutral surfaces.
- Flat by default, with elevation reserved for interaction and overlays.
- Familiar product controls with a consistent Fluent vocabulary.
- Quiet distinctiveness through assistant objects, trust metadata, and workflow language rather than decorative AI imagery.
- Light and dark themes with equivalent hierarchy and behavior.

Avoid ornamental gradients, glassmorphism, decorative blue backgrounds, excessive shadows, novelty controls, and visual effects that compete with the task.

## 2. System architecture

### Fluent first

Use Fluent UI components and their public APIs whenever they can express the intended interface.

Apply styling in this order:

```text
Fluent component props and appearances
-> Fluent theme tokens
-> MUCGPT product pattern or app token
-> local CSS
```

Local CSS must not duplicate behavior already provided by Fluent.

### Theme files

The theme implementation lives in:

```text
mucgpt-frontend/src/ui/theme/
|-- palette.ts
|-- fluentTheme.ts
`-- appTokens.ts
```

The runtime theme flow is:

```text
palette.ts
-> createMucgptTheme(isLight)
-> createScaledTypographyTheme(theme, scaling)
-> FluentProvider
```

`Layout.tsx` installs the Fluent theme and exposes the small set of `--app-*` variables on the document root.

### Token ownership and raw values

The color system has two legitimate sources of raw color values inside the theme layer. They serve different purposes:

1. **`palette.ts` owns reusable primitives.** Brand, neutral, success, warning, danger, and information ramps live here when multiple semantic tokens or components need the same underlying values. `fluentTheme.ts` maps these primitives onto Fluent semantic tokens.
2. **`appTokens.ts` owns isolated product semantics.** A product-specific token may define its light and dark raw values directly when Fluent has no equivalent and the values do not form a reusable palette. It may instead reference a primitive from `palette.ts` when that color is shared.

This means `palette.ts` is the source of reusable color ramps, not necessarily every color literal in the application. `appTokens.ts` is part of the theme layer and is therefore allowed to own deliberate semantic values.

The hard boundary is feature code:

- Components, pages, and feature CSS must not consume primitive ramps directly.
- Components, pages, and feature CSS must not introduce raw color literals.
- Feature code consumes Fluent semantic tokens first and `--app-*` tokens only for documented MUCGPT-specific concepts.
- A new reusable color family belongs in `palette.ts`.
- A new isolated product semantic without a Fluent equivalent belongs in `appTokens.ts`.
- A value that already has an appropriate Fluent semantic must not become an app token.

This separation preserves a small semantic API for feature code without forcing one-off product meanings into Fluent or turning `appTokens.ts` into a parallel design system.

## 3. Color

### Color strategy

MUCGPT uses a restrained color strategy. Neutral surfaces carry the interface. Blue earns attention and is reserved for:

- primary actions;
- links;
- focus;
- selected and active states;
- assistant identity;
- high-value product state.

Blue is not a decorative background motif.

### Brand

| Role            | Light     | Dark      |
| --------------- | --------- | --------- |
| Primary action  | `#2563EB` | `#86A4E5` |
| Primary hover   | `#1D4ED8` | `#A0B8ED` |
| Primary pressed | `#1E40AF` | `#6F90D8` |

Standard primary actions use Fluent appearances:

```tsx
<Button appearance="primary" />
```

Do not manually redefine standard button colors or interaction states.

### Neutral surface hierarchy

Use the Fluent neutral backgrounds as one shared hierarchy in both themes:

| Token                        | Product role                                         |
| ---------------------------- | ---------------------------------------------------- |
| `colorNeutralBackground3`    | Deepest application surface and page canvas          |
| `colorNeutralBackground2`    | Navigation, grouped controls, and secondary surfaces |
| `colorNeutralBackground1`    | Raised content surface and generic card level        |
| `colorNeutralCardBackground` | Fluent card surface                                  |

Do not add a separate generic surface or card palette. Add an app token only when a surface has a stable MUCGPT-specific meaning.

### Semantic states

Success, warning, danger, and information colors communicate status, validation, and operational feedback. They are not decorative palette colors.

Feature code uses semantic state tokens such as:

```css
var(--colorStatusSuccessForeground1)
var(--colorStatusWarningForeground1)
var(--colorStatusDangerForeground1)
```

Some Fluent components internally consume `colorPaletteGreen*`, `colorPaletteYellow*`, or `colorPaletteRed*`. The MUCGPT theme aliases these Fluent palette tokens to the corresponding MUCGPT status mappings so Fluent components and custom feature styles render the same status language. Feature code should still use `colorStatus*` tokens for semantic states.

Fluent does not provide an equivalent `colorStatusInfo*` family. The documented information extension is exposed through the relevant `--app-status-info-*` token.

### Borders and contrast

Use semantic stroke tokens according to purpose:

- `colorNeutralStroke2` or `colorNeutralStroke3` for decorative separators that are not required to identify a control.
- `colorNeutralStroke1` for standard structural borders when it provides sufficient distinction in context.
- `colorNeutralStrokeAccessible` when a boundary is necessary to identify or operate an interactive component.
- `colorBrandStroke1` for selected or active borders.
- Fluent status border tokens for semantic states.

Do not assume that every neutral stroke token meets the WCAG 3:1 non-text contrast requirement on every surface. Test the actual foreground and adjacent background combination whenever the boundary communicates interaction, selection, focus, or status.

Status and selection must never rely on color alone. Pair color with text, an icon, border weight, shape, or an accessible state.

## 4. Typography

MUCGPT uses Fluent typography as its product UI system. The type should feel native, readable, and efficient in Windows-first municipal workplaces.

### Font families

- **Application UI:** Fluent `fontFamilyBase`.
- **Brand wordmark:** Montserrat 700.
- **Code and technical content:** Fluent `fontFamilyMonospace`.

Montserrat is reserved for MUCGPT branding. Do not introduce additional font families without an explicit design-system decision.

### Hierarchy

- **Display:** Exceptional first-screen product headings only.
- **Page title:** `Title1` or `Title2`, selected according to page hierarchy.
- **Section title:** Fluent title/subtitle role or its corresponding typography tokens.
- **Body:** Descriptions, guidance, responses, and explanatory content.
- **Label:** Forms, settings, metadata, and compact controls.
- **Caption:** Badges, secondary metadata, timestamps, and supporting status text.

Prefer Fluent components such as `Title1`, `Title2`, `Title3`, `Subtitle1`, `Body1`, `Body2`, `Caption1`, and `Text`, or their underlying typography tokens.

Do not use arbitrary `font-size`, `line-height`, or `font-weight` values when a Fluent role fits. Product copy should generally stay within 65 to 75 characters per line. Data-heavy interfaces may be wider where scanning requires it.

User font scaling is applied centrally by `createScaledTypographyTheme`. Feature typography must use the scaled Fluent tokens so this setting remains effective.

### Product language

Labels describe the user's job outcome before technical model mechanics. Prefer “How should the assistant respond?” over “System prompt” where context permits.

Copy should be concise but not cryptic. Users need enough context to understand what will happen and whether an assistant is appropriate for their task.

## 5. Spacing, shape, and elevation

### Spacing

Use Fluent spacing tokens for component spacing and common layout rhythm. Values such as 4, 8, 12, 16, 20, 24, and 32 pixels are represented by the Fluent spacing scale.

```css
.toolbar {
  gap: var(--spacingHorizontalM);
}
```

Dedicated values are appropriate for structural dimensions such as readable widths, responsive breakpoints, navigation width, drawer width, and page gutters. Repeated structural values should become named layout semantics.

### Radius

MUCGPT overrides the Fluent radius scale globally:

| Fluent token           | Value    |
| ---------------------- | -------- |
| `borderRadiusSmall`    | `6px`    |
| `borderRadiusMedium`   | `10px`   |
| `borderRadiusLarge`    | `12px`   |
| `borderRadiusXLarge`   | `16px`   |
| `borderRadiusCircular` | Circular |

Standard Fluent components inherit this scale. Do not override Button, Input, Dialog, or similar component radii locally without a product-specific reason.

Product geometry that Fluent cannot represent may use app tokens. The chat bubble uses `--app-radius-xxlarge` for its 24px body radius and `--app-radius-xsmall` for its 2px tail corners.

### Elevation

Static surfaces are flat. Separate cards, panels, sections, and configuration rows through background, border, spacing, and radius.

Use Fluent shadows only when elevation communicates behavior:

- low lift for a hovered or dragged work object;
- overlay lift for menus, popovers, dialogs, and drawers;
- floating controls that genuinely sit above content.

Do not add custom shadows when a Fluent shadow token is sufficient.

## 6. Layout and responsive behavior

MUCGPT uses predictable product layouts: persistent navigation, clear page headers, assistant grids or lists, split workspaces, tabs, drawers, and inline editors.

### App shell

- Desktop uses a persistent left navigation rail.
- Collapsed navigation preserves recognizable icons and accessible tooltips.
- Mobile uses an overlay drawer with the same vocabulary and information architecture.
- Navigation supports clear orientation without becoming the visual center.
- Page content uses a readable maximum width where the task does not require a full-width workspace.

### Responsive composition

Responsive behavior is structural. Collapse navigation, adapt grids, stack control groups, and change drawer behavior at deliberate breakpoints. Do not use fluid display typography as a substitute for responsive composition.

The assistant discovery grid uses three columns on wide layouts, two columns below 1024px, and one column below 550px. When the details drawer materially reduces the available content width, the grid and section controls adapt to the remaining space rather than only to the viewport.

Touch targets, focus order, labels, and functionality must remain equivalent across layouts.

## 7. Core product patterns

### Assistant discovery page

The discovery page leads users from a work need to an appropriate assistant.

- The page header uses a clear title, a concise purpose statement, a primary create action, and a lower-emphasis import action.
- Search spans the available content width and uses a grouped neutral surface.
- “My assistants” and community discovery are separate, clearly titled sections.
- Ownership filters use a small Fluent `TabList` because they switch between mutually exclusive views of the same collection.
- Sorting uses Fluent `Dropdown` controls.
- Empty states offer concrete next actions instead of merely reporting that no content exists.
- Loading collections use card-shaped skeletons to preserve layout and reduce movement.

### Assistant cards

Assistant cards are a signature MUCGPT product object. They are appropriate in discovery surfaces because each card represents a reusable workflow rather than generic content.

Each card makes the following scannable:

- name and concise purpose;
- owner or source;
- visibility or sharing scope;
- relevant compliance or lifecycle state;
- tool or capability indicators where useful;
- popularity or usage metadata where useful;
- selected state when a related details surface is open.

Card anatomy follows a consistent hierarchy:

1. Title and compact status badges.
2. A short description, normally clamped to two lines in a grid.
3. A footer containing owner/source metadata and visibility or subscriber information.

Cards are flat at rest with a full border. Hover may lift by a single pixel and strengthen the border or title color. Selected cards use a full selected border, never a colored side stripe. Focus styling must remain at least as prominent as hover and selection.

Interactive cards must expose their action and current state semantically, not only through click handlers or color. Nested actions such as owner contact links must remain independently operable and must not accidentally trigger the card action.

### Trust and status badges

Badges communicate compact metadata such as private/shared scope, local state, compliance status, publication state, or assistant identity.

- Neutral metadata uses a neutral tinted badge.
- Success, warning, and danger use Fluent tint appearances backed by the MUCGPT status mappings.
- Status badges may use stronger type weight than neutral metadata.
- Blue is reserved for selection or assistant identity, not generic metadata.
- Badge text must remain understandable without relying on color.

### Assistant workspace

Assistant use must preserve context. Users should always understand which assistant is active and what it is configured to do.

Good workspace patterns include:

- assistant header with title, scope, owner, and primary action;
- compact trust metadata near the title;
- stable chat composer at the bottom or within the local work surface;
- optional disclosure or side panel for tools, examples, models, and configuration details;
- visible distinction between private, shared, and broadly visible assistants.

### Chat composer

The composer is a work control, not decorative chatbot chrome.

- It remains visually stable while typing.
- Send, attach, tools, and options appear in predictable locations.
- Multiline input does not cause disruptive layout jumps.
- Focus is clear and keyboard operation is complete.
- Placeholder text is practical and task-oriented.

### Assistant configuration

Configuration favors sectioned pages, inline editing, and progressive disclosure over large modal flows.

- Organize role, behavior, tools, examples, sharing, and model settings into understandable sections.
- Lead with plain-language labels and provide technical details as secondary information.
- Provide preview or test affordances where users need to validate behavior.
- Distinguish draft, saved, changed, shared, disabled, and error states.
- Use reorder controls only where order changes behavior.

Assistant configuration surfaces use the documented `--app-assistant-config-*` tokens because their states are stable MUCGPT product semantics without direct Fluent equivalents.

### Empty states

Empty states help users start. They should contain a concise explanation and the smallest useful set of actions, for example:

- create an assistant;
- import an assistant;
- discover shared assistants;
- reset a search;
- test the current assistant.

Avoid generic “nothing here” messages and long product explanations.

## 8. Components and CSS

### Fluent components

Use Fluent components directly whenever possible, including `Button`, `Input`, `Textarea`, `SearchBox`, `Dropdown`, `TabList`, `Dialog`, `Menu`, `Card`, `Badge`, and `Tooltip`.

Do not create wrappers such as `MucButton`, `MucInput`, or `MucDialog` merely to apply visual styling. Shared components are justified when they represent a reusable product pattern, such as `PageHeader`, `AssistantCard`, `EmptyState`, or `Toolbar`.

Every interactive component needs the states relevant to its behavior: default, hover, focus, active, selected, disabled, loading, and error.

### CSS modules

Use CSS Modules for:

- layout and responsive composition;
- grid and flex behavior;
- documented product-specific visuals;
- geometry Fluent cannot express;
- complex application states that cannot be represented through public Fluent APIs.

CSS should not redefine standard Fluent button colors, standard typography, standard radii, focus behavior, or generic disabled states.

Avoid:

- `!important`;
- `.fui-*` selectors;
- private Fluent custom properties or data attributes;
- raw color literals in feature code;
- arbitrary typography and radii;
- `transition: all`;
- unnecessary absolute positioning.

Never depend on undocumented Fluent DOM structure when a public component prop, slot, appearance, or theme token is available.

## 9. Motion

Motion explains state changes and spatial relationships. It is not decoration.

- Use approximately 120ms to 160ms for color, border, and focus changes.
- Use approximately 160ms to 220ms for hover lift and compact reveals.
- Use up to 300ms for drawers and navigation collapse.
- Prefer transform and opacity over layout properties.
- Use restrained ease-out curves without bounce or elastic effects.
- Do not orchestrate page-load animation sequences.
- Respect `prefers-reduced-motion` for every non-essential transition and animation.

## 10. Themes

Light and dark modes are equal product themes, not independent component variants.

- Both themes are created through the central Fluent theme.
- Components consume Fluent tokens or documented app tokens.
- App tokens define light and dark behavior where required.
- Components must not read `prefers-color-scheme` or `localStorage` independently.
- Theme switching must preserve hierarchy, semantic meaning, contrast, and component state.

## 11. Accessibility and inclusion

MUCGPT targets WCAG 2.1 AA.

Required behavior:

- complete keyboard operation and logical focus order;
- visible focus indicators;
- correct native or ARIA semantics;
- accessible names for icon-only controls;
- sufficient text and non-text contrast in both themes;
- non-color indicators for state and selection;
- user font scaling without clipping or loss of content;
- reduced-motion support;
- predictable wrapping across desktop and mobile;
- loading and status feedback that is available to assistive technology.

Prefer Fluent components because they provide accessible behavior, but do not assume that composition remains accessible automatically. Interactive cards, nested actions, custom CSS, responsive reordering, and application-managed selection require explicit verification.

Accessibility is a product requirement, not a final polish step. MUCGPT serves people with different devices, reading preferences, abilities, and levels of confidence with AI.

## 12. Do and do not

### Do

- Make assistants visually and structurally primary.
- Show trust metadata where it affects confidence.
- Use work-oriented language before technical AI language.
- Prefer Fluent components and public APIs.
- Keep blue rare and meaningful.
- Use progressive disclosure for advanced configuration.
- Preserve equivalent behavior in light, dark, desktop, mobile, keyboard, and scaled-text contexts.
- Test the actual token combinations used by interactive elements.

### Do not

- Make MUCGPT resemble a dense enterprise administration console.
- Copy the visual identity of generic AI chat products.
- Make assistant configuration resemble raw prompt-file editing unless the user explicitly chooses an advanced mode.
- Hide tool usage, ownership, or assistant scope behind friendly chat UI.
- Use ornamental gradients, gradient text, decorative blue surfaces, or default glassmorphism.
- Add shadows to static surfaces.
- Use thick colored side borders on cards, callouts, lists, or alerts.
- Nest cards inside cards.
- Use a modal as the first solution when inline or progressive interaction is viable.
- Imply autonomous execution when human review is required.

## 13. Styling decision guide

Before adding styling, ask:

```text
Can Fluent express this through a component prop, slot, or appearance?
    -> no

Can the Fluent theme express this globally with an existing semantic token?
    -> no

Is this a stable and repeated MUCGPT product semantic?
    -> no

Is local CSS genuinely necessary?
```

If the answer introduces a new token, decide whether it is a reusable primitive for `palette.ts` or an isolated product semantic for `appTokens.ts`. Feature code consumes the resulting semantic token, never the raw value.

Implementation details and the complete active token inventory are documented in `mucgpt-frontend/docs/theme-tokens.md`.
