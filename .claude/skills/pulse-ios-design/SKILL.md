---
name: pulse-ios-design
description: Build or restyle mobile web screens in the Pulse & Protocol iOS-style design system. It is dark-first with a light theme, uses teal and green accents, a frosted sticky nav under the iOS status bar, safe-area insets, 44px tap targets and a 420px phone column, and installs as a PWA. Use when the user asks for a new page, tool, screen or component "in my iOS design", "in the Pulse style", "like Pulse & Protocol", or wants an existing page made to match it. Not for native SwiftUI code; for a SwiftUI port, read references/tokens.md and map the tokens.
---

# Pulse iOS design

This is the design system from the Pulse-Protocol repo (`css/pulse.css`, `js/theme.js`, plus the
component styles in `css/home.css`, `css/calculator.css` and `css/quiz.css`). It is a web design built to feel
native on iPhone: it is added to the Home Screen, runs standalone, and works offline.

## Files in this skill

| File | Use |
|---|---|
| `assets/pulse.css` | **Copy verbatim** into the project as `css/pulse.css`. It holds the tokens (dark and light), base styles, nav, toast, offline badge, and the a11y and reduced-motion rules. |
| `assets/components.css` | Copy as `css/components.css`. It has the reusable components: buttons, cards, link rows, readout, callouts, inputs, segmented control, disclosure, choice rows, chips, progress, tables. |
| `assets/theme.js` | Copy as `js/theme.js`. Load it **synchronously in `<head>`**. It follows the system theme, saves a manual override, and injects the toggle into `.nav-links`. |
| `assets/starter.html` | The page shell to start every screen from: meta tags, nav, `<main class="wrap">`, and one of each core component. |
| `references/tokens.md` | Token tables, type scale and the rationale behind each token. Read it before inventing any value. |

In an existing Pulse project, `css/pulse.css` and `js/theme.js` are already there. Link them and don't copy them.

## Workflow

1. Start from `assets/starter.html`. Keep the `<head>` meta block whole: `viewport-fit=cover`,
   `apple-mobile-web-app-status-bar-style: black-translucent`, `theme-color`, `color-scheme`, the manifest
   and the apple-touch-icon. Without them the standalone iOS look breaks.
2. Build the screen from the classes in `components.css`. If a component is missing, write it **in the same
   style** (see the rules below) and add it to the page's own `css/<page>.css`. Don't add inline colours.
3. Check it at 320px, 375px and 430px wide, in both themes, and with `prefers-reduced-motion`. Use Playwright
   (`devices['iPhone 13']`) if it's available.

## Rules the code follows (keep them)

**Colour**
- Use only tokens: `var(--bg|--surface|--border|--text|--text-soft|--text-muted|--text-faint)` and the accents
  `--green --teal --amber --red --purple`. Never write hex values in components.
- For tints, use `rgba(var(--X-rgb), a)`. Fills are 0.10–0.15, borders 0.3–0.4, glows 0.4 inside
  `0 0 30px -15px`. Every accent has a `--X-rgb` twin for this reason.
- Each accent has a meaning. **Green** is the primary action, success, the live dot and the main number.
  **Teal** is focus, hover borders, section labels and the selected segment. **Amber** is caution and
  disclaimers. **Red** is danger and wrong answers. **Purple** is a rare extra category.
- Text on a filled green or teal button is `var(--bg)`, not white.
- The light theme darkens the accents so they still pass WCAG AA. A new token needs a value in **both**
  `:root` and `:root[data-theme="light"]`, and its contrast must be checked (aim for 4.5:1 or more).

**Shape and spacing**
- Radii are `--radius-sm` 8 (segments, nav links), `--radius` 12 (inputs, callouts, choice rows),
  `--radius-lg` 16 (cards), 10 (buttons, icon tiles), 14 (link rows) and `--radius-pill`.
- Cards are a `--surface` fill with a 1px `--border` and 18–20px padding. Nested boxes sit on `--bg`
  (`.note-box`, `.opt`, `.explain`), so depth goes bg → surface → bg.
- Content sits in one column: `--shell-w` 420px plus a 16px `--shell-pad`. The nav uses the same width, so the
  two line up. Desktop can widen it with `@media (min-width: 800px)`.
- Use few shadows: only `--shadow` (toast) and the accent glow on hero readouts.

**Type**
- The font is the system stack (`--font-sans`, which is SF Pro on iOS), and `--font-mono` is for numbers that
  need to line up.
- The scale: 11px uppercase labels with 1.5px tracking · 12–13.5px body and secondary text · 14px row titles and
  buttons · 15px question text · 16px card titles · 24–44px bold numbers (`.big-num`) · 32px/800 hero brand at
  −0.5px tracking.
- Weights are 700 for labels and buttons and 800 for brand and titles. Don't use light weights.

**iOS specifics**
- Every tappable element is at least `min-height: var(--tap)` (44px) and, where it is icon-only, at least
  `min-width: var(--tap)`.
- Inputs are 16px on touch screens (`@media (max-width:480px) and (pointer:coarse)`) so iOS doesn't zoom in.
- Sticky chrome pads with `env(safe-area-inset-*)`. The nav paints a dark strip under the status bar
  (`--statusbar-bg`) because the bar's text is white in `black-translucent` mode.
- The nav is frosted: a `--nav-bg` at 92% opacity plus `backdrop-filter: blur(8px)`, with the `-webkit-` prefix.
- Set `-webkit-tap-highlight-color: transparent` and give `:active` the same state as `:hover`.
- The Add to Home Screen hint uses `@supports (-webkit-touch-callout: none)` (`.ios-only`).

**Accessibility (must keep)**
- Every page needs a skip link, `<main id="main" tabindex="-1">`, `aria-current="page"` on the active nav item,
  and `:focus-visible` rings (teal, 2px). Live results need `aria-live="polite"` and toggles need `aria-pressed`
  or `aria-expanded`.
- Respect `prefers-reduced-motion`; `pulse.css` already does. Keep motion to 0.15–0.4s ease, and use
  `.dot` as the only looping animation.

## Native SwiftUI port

If the user wants this design in Swift, map the tokens in `references/tokens.md` to a `Color` asset catalog
with Any/Dark appearances. Use `.font(.system(...))` with the same sizes, 44pt frames, `RoundedRectangle`
radii of 8/12/16, and `.ultraThinMaterial` for the nav. The accent meanings stay the same.
