---
name: MUCGPT
description: A modern municipal AI assistant platform centered on reusable workflow-specific assistants.
colors:
  primary-action: "#2563eb"
  primary-action-hover: "#1d4ed8"
  primary-action-pressed: "#1e40af"
  primary-soft: "#DBEAFE"
  primary-soft-foreground: "#1E3A8A"
  primary-strong: "#1A4DBB"
  light-surface-base: "#f8fafc"
  light-surface-raised: "#f1f5f9"
  light-surface-subtle: "#FFFFFF"
  text-default: "#1E293B"
  text-secondary: "#334155"
  text-tertiary: "#526077"
  outline-base: "#B8C7E6"
  outline-subtle: "#D7E0F2"
  dark-surface-base: "#0F172D"
  dark-surface-raised: "#020617"
  dark-surface-subtle: "#13203C"
  dark-text-default: "#F1F5F9"
  dark-text-secondary: "#94A3B8"
  dark-text-tertiary: "#64748B"
  dark-outline-base: "#334155"
  dark-outline-subtle: "#1E293B"
  success-bg: "#E7F6EE"
  success-border: "#8CC9A6"
  success-fg: "#14532D"
  warning-bg: "#FFF4DB"
  warning-border: "#E0A63A"
  warning-fg: "#744904"
  error-bg: "#FDECEC"
  error-border: "#E37D7D"
  error-fg: "#8A1C1C"
typography:
  display:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, \"Roboto\", \"Helvetica Neue\", sans-serif"
    fontSize: "2.4rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "normal"
  headline:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, \"Roboto\", \"Helvetica Neue\", sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "34px"
  title:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, \"Roboto\", \"Helvetica Neue\", sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, \"Roboto\", \"Helvetica Neue\", sans-serif"
    fontSize: "var(--fontSizeBase400)"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, \"Roboto\", \"Helvetica Neue\", sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
  brand:
    fontFamily: "\"Montserrat\", \"Segoe UI\", sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.01em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  card: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-action}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  assistant-card:
    backgroundColor: "Fluent colorNeutralCardBackground"
    textColor: "{colors.text-default}"
    rounded: "{rounded.card}"
    padding: "16px"
  chat-input:
    backgroundColor: "Fluent colorNeutralBackground1"
    textColor: "{colors.text-default}"
    rounded: "{rounded.lg}"
    padding: "10px 8px 10px 16px"
  trust-chip:
    backgroundColor: "Fluent colorNeutralBackground2"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
---

# Design System: MUCGPT

## 1. Overview

**Creative North Star: The Municipal Assistant Workbench**

MUCGPT should feel like a precise, modern workbench for municipal AI work. It is not a decorative AI demo, not a generic chatbot, and not a heavy administration console. The interface should help employees find, understand, create, and use assistants with confidence.

The product has two visible layers:

- **Assistants as reusable work objects.** Assistants carry purpose, ownership, scope, instructions, tools, and trust signals.
- **Chat as the execution surface.** Chat is where work happens, but it should not erase the assistant context around it.

The interface should feel calm, capable, and current. It should reduce anxiety for first-time AI users while giving experienced users enough speed, detail, and control to make MUCGPT their preferred tool.

### Key Characteristics

- Assistant-first structure: discovery, creation, configuration, sharing, and reuse are first-class workflows.
- Clear trust signals: ownership, visibility, intended use, tools, and configuration status are visible where they affect user confidence.
- Modern municipal tone: reliable and accessible, but not bureaucratic or visually dated.
- Product-native controls: Fluent UI components lead the visual system; MUCGPT app tokens extend Fluent only where the product needs more specific semantics.
- Restrained visual language: color, motion, shadows, and density communicate state and hierarchy, not decoration.

## 2. Visual Direction

MUCGPT should look like a high-quality internal product that municipal employees choose willingly, not a compliance portal they tolerate.

The design should prioritize:

- **Clarity before novelty.** Users should understand what to do without reading long explanations.
- **Confidence before speed.** Fast flows matter, but users must understand what an assistant is about to do.
- **Progressive detail.** Show the useful summary first, then reveal prompts, tools, model choices, examples, and advanced settings when needed.
- **Earned density.** Dense screens are acceptable for power workflows, but density must be structured through spacing, grouping, and hierarchy.
- **Quiet distinctiveness.** MUCGPT should have its own product identity through assistant objects, trust metadata, and workflow language, not through decorative AI visuals.

## 3. Color

The palette is Fluent-first. Fluent UI neutral, foreground, stroke, shadow, spacing, and component state tokens should lead most surfaces and controls. MUCGPT app tokens exist only where the product needs more specific semantics than Fluent provides.

The overall effect should still be a restrained civic blue system on calm neutral surfaces. It should avoid both sterile white software and heavy dark-blue dashboard aesthetics.

### Primary

- **Civic Action Blue**: Used for primary actions, selected states, focus, links, and assistant identity.
- **Civic Action Hover / Pressed**: Used only for interaction states.
- **Soft Assistant Blue**: Used for low-emphasis assistant identity, selected metadata, and subtle active surfaces.
- **Deep Assistant Blue**: Used for readable text on soft blue surfaces and strong assistant links.

### Fluent Neutral System

- Use Fluent neutral background tokens for the main app canvas, navigation rail, panels, cards, dialogs, popovers, menus, inputs, and grouped controls.
- Use Fluent foreground tokens for default, secondary, tertiary, disabled, and inverse text.
- Use Fluent stroke tokens for borders, separators, hover outlines, and focus-adjacent structure.
- Use Fluent shadows for overlays and interactive lift.
- Use `themeTokens.ts` to tune the Fluent theme values, not to create a parallel surface vocabulary.

### App-Specific Tokens

MUCGPT app tokens are allowed where Fluent is too generic:

- Primary action overrides.
- Assistant configuration surfaces and borders.
- Assistant metadata or trust states where Fluent state tokens are not specific enough.
- Status colors where the default Fluent semantic token does not fit the product state.

### Semantic States

Success, warning, error, and info colors are functional. They should support state, validation, and operational feedback. They are not decorative palette colors.

### Named Rules

**The Blue Earns Attention Rule.** Blue is reserved for action, selection, focus, links, assistant identity, and high-value state. Do not use blue as a decorative background pattern.

**The Fluent First Rule.** Reach for Fluent UI tokens first: `--colorNeutralBackground*`, `--colorNeutralForeground*`, `--colorNeutralStroke*`, `--shadow*`, `--borderRadius*`, and standard component states.

**The App Token Extension Rule.** Use `--app-*` variables only for MUCGPT-specific semantics such as primary actions, assistant configuration rows, status extensions, and assistant metadata. Do not introduce raw hex colors into component CSS.

## 4. Typography

MUCGPT uses a system sans-serif stack for product UI. The type should feel native, readable, and efficient across Windows-first municipal environments.

### Hierarchy

- **Display**: First-screen product headings only. Do not use inside dialogs, cards, settings, or navigation.
- **Headline**: Major page titles and assistant discovery pages.
- **Title**: Assistant card titles, dialog titles, section titles, and compact workspace headers.
- **Body**: Descriptions, assistant guidance, responses, and explanatory text.
- **Label**: Form labels, settings labels, metadata labels, and compact UI text.
- **Micro Label**: Badges, metadata, table captions, and status labels.

### Named Rules

**The Work Language Rule.** Labels should describe the user's job outcome before exposing technical AI mechanics. Prefer "How should the assistant respond?" over "System prompt" where the context allows.

**The Compact Confidence Rule.** Text should be concise, but not cryptic. Public-sector users need enough context to trust what will happen.

**The Product Type Rule.** Do not introduce display fonts into labels, buttons, navigation, data, assistant configuration, or chat controls.

## 5. Layout

MUCGPT should use predictable product layouts: persistent navigation, clear page headers, assistant grids or lists, split workspaces, tabs, drawers, and inline editors.

### App Shell

The app shell uses a persistent left rail on desktop and an overlay drawer on mobile. The rail should support quick orientation and assistant access without becoming the visual center.

Recommended structure:

- Main navigation for product areas.
- Clear active state with a neutral selected background and a narrow blue indicator.
- Collapsed mode that preserves icon recognition and tooltips.
- Mobile drawer with the same vocabulary as desktop navigation.

### Assistant Workspace

Assistant usage should preserve context. A user should always understand which assistant they are using and what it is configured to do.

Good workspace patterns include:

- Assistant header with title, scope, owner, and primary action.
- Compact trust metadata near the assistant title.
- Chat composer as a stable bottom or local work surface.
- Optional side panel or disclosure area for tools, examples, model settings, and configuration details.
- Clear distinction between private assistants, shared assistants, and broadly visible assistants.

### Configuration

Assistant configuration should prefer inline editing and progressive disclosure over large modal flows.

Use:

- Sectioned forms for role, behavior, tools, examples, sharing, and model settings.
- Plain-language labels with technical details available as secondary text.
- Preview or test affordances where users can validate assistant behavior.
- Save states that distinguish draft, saved, shared, and changed configurations.

## 6. Components

### Buttons

Buttons should be familiar and restrained.

- Primary buttons use Civic Action Blue and are reserved for starting, saving, publishing, or confirming a core workflow.
- Secondary buttons use neutral surfaces and clear hover states.
- Destructive actions use semantic error styling and require clear labels.
- Icon buttons should use recognizable icons with accessible labels and tooltips where needed.

### Assistant Cards

Assistant cards are the signature product object. They should not look like generic content cards.

Each assistant card should make the following scannable:

- Name and concise purpose.
- What kind of work it supports.
- Owner or source when relevant.
- Visibility or sharing scope.
- Tool/capability indicators when relevant.
- Last changed or trust metadata where useful.
- Direct start action and secondary details action.

At rest, assistant cards are flat with a clear border. Hover may lift slightly and strengthen the border. Selected cards use a full border or selected surface, not a side stripe.

### Trust Chips

Trust chips show metadata that affects confidence: private/shared, department scope, owner, tools, model, draft, published, or changed.

They should be compact, readable, and neutral by default. Blue is only used when the chip represents selection or assistant identity.

### Chat Composer

The composer is an important work control, not a decorative chatbot input.

It should:

- Stay visually stable while typing.
- Expose send, attach, tool, and option controls predictably.
- Use a clear focus state.
- Support multiline input without layout jumps.
- Keep placeholder text practical and specific.

### Configuration Rows

Prompt starters, tools, examples, and behavior rules should appear as editable work objects.

Rows should support:

- Clear title and short description.
- Visible edit and remove affordances.
- Drag or reorder only where ordering matters.
- Changed, disabled, error, and active states.
- Inline editing before modal editing.

### Empty States

Empty states should help users start, not explain the whole product.

Use concrete actions:

- Create an assistant.
- Start from a suggested assistant.
- Search shared assistants.
- Add a quick starter.
- Test this assistant.

Avoid generic "nothing here" messages.

## 7. Elevation

MUCGPT is flat by default and uses Fluent tonal layering first. Shadows communicate interaction or overlay state.

### Shadow Vocabulary

- **Flat at rest**: Cards, panels, responses, and configuration rows.
- **Low lift**: Assistant card hover, focusable work objects, and mobile affordances.
- **Overlay lift**: Popovers, menus, dialogs, and drawers.
- **Primary lift**: Rare hover treatment for primary actions.

### Named Rule

**The Flat At Rest Rule.** Cards, panels, and answer containers are flat at rest. Add shadow only when the user is hovering, focusing, dragging, or opening an overlay.

## 8. Motion

Motion should help users understand state changes.

Use short transitions:

- 120ms to 160ms for color, border, and focus changes.
- 160ms to 220ms for hover lifts, row reveals, and chip affordances.
- Up to 300ms for drawer open/close or sidebar collapse.

Motion should respect reduced-motion preferences. Do not animate layout-heavy properties where transform or opacity can express the same state.

## 9. Accessibility

MUCGPT targets WCAG 2.1 AA.

Required behavior:

- Keyboard access for all interactive controls.
- Visible focus states.
- Screen-reader labels for icon-only actions.
- Sufficient color contrast in light and dark themes.
- Non-color indicators for status and selection.
- Reduced-motion support.
- Text that wraps predictably across desktop and mobile.

Accessibility is a product requirement, not a final polish step. The user base includes people with very different AI confidence levels, reading preferences, devices, and workplace environments.

## 10. Do's and Don'ts

### Do

- Do make assistants visually primary. Discovery, configuration, sharing, and reuse deserve more design attention than generic chat chrome.
- Do show trust metadata where it affects user confidence.
- Do use work-oriented language before technical AI language.
- Do use Fluent UI components where practical and tune them through product tokens.
- Do keep the blue accent rare and meaningful.
- Do support both simple first-time use and faster power-user flows.
- Do prefer inline editing, previews, and progressive disclosure over modal interruption.
- Do preserve keyboard focus states, reduced-motion friendliness, and WCAG 2.1 AA contrast.

### Don't

- Don't make MUCGPT feel like a dense enterprise admin console.
- Don't make it a direct ChatGPT, Gemini, or generic chatbot clone.
- Don't make assistant configuration feel like editing a raw prompt file unless the user has chosen an advanced mode.
- Don't hide tool usage or assistant scope behind friendly chat UI.
- Don't use startup SaaS decoration, ornamental gradients, glassmorphism, or decorative blue backgrounds.
- Don't introduce raw hex colors into app CSS or components. Add semantics in `themeTokens.ts` first.
- Don't use border-left or border-right greater than 1px as a colored accent on cards, callouts, lists, or alerts.
- Don't add shadows to static surfaces.
- Don't imply autonomous execution when a human-in-the-loop decision is required.

## 11. Implementation Notes

The design system should be implemented through Fluent UI theme tokens, `themeTokens.ts`, and CSS modules.

Component CSS should prefer Fluent variables such as:

- `--colorNeutralBackground1`
- `--colorNeutralBackground2`
- `--colorNeutralCardBackground`
- `--colorNeutralForeground1`
- `--colorNeutralForeground2`
- `--colorNeutralStroke1`
- `--colorBrandBackground`
- `--shadow4`
- `--borderRadiusMedium`

Use MUCGPT app variables only for product-specific extensions already exposed by `themeTokens.ts`, such as:

- `--app-primary-action-background`
- `--app-primary-action-hover`
- `--app-primary-action-pressed`
- `--app-primary-action-foreground`
- `--app-status-error-background`
- `--app-status-info-background`
- `--app-assistant-config-surface`
- `--app-assistant-config-surface-hover`
- `--app-assistant-config-surface-editing`
- `--app-assistant-config-border`
- `--app-assistant-config-border-hover`

When a new visual need appears, first check whether Fluent already has the right token. Add an app token only when the meaning is MUCGPT-specific and likely to be reused.

The machine-readable design source in `.impeccable/design.json` should mirror these principles and avoid examples that encourage raw hex values or a parallel non-Fluent surface system in component CSS.
