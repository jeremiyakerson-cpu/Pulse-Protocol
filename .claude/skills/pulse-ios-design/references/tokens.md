# Pulse tokens

The source of truth is `assets/pulse.css`. This file explains the tokens; if the two disagree, the CSS wins.

## Colour

| Token | Dark (default) | Light | Role |
|---|---|---|---|
| `--bg` | `#0E1A24` | `#F4F7F8` | Page; nested boxes inside cards |
| `--surface` | `#142430` | `#FFFFFF` | Cards, inputs, segmented track |
| `--border` | `#22384A` | `#D3DEE3` | 1px hairlines everywhere |
| `--text` | `#E8F0F2` | `#0E1A24` | Primary text |
| `--text-soft` | `#C7D4D9` | `#26394A` | Paragraphs in cards |
| `--text-muted` | `#8FA8B3` | `#4A6070` | Labels, subtitles, inactive nav |
| `--text-faint` | `#7F929C` | `#5B6F7B` | Placeholders, fine print (AA at 5.4:1 on bg) |
| `--green` | `#35D07F` | `#0E7A45` | Primary action, success, live dot, big numbers |
| `--teal` | `#2FB8C6` | `#0A6F7C` | Focus ring, hover border, section labels, active segment |
| `--amber` | `#F2A93B` | `#8F5300` | Caution, disclaimers, streaks |
| `--red` | `#E5533D` | `#B8321E` | Danger, wrong answer |
| `--purple` | `#B98CE0` | `#7440A8` | Extra category colour |
| `--nav-bg` | `rgba(14,26,36,.92)` | `rgba(244,247,248,.92)` | Frosted nav |
| `--statusbar-bg` | `#0E1A24` | (same, always dark) | Strip under the iOS status bar |
| `--shadow` | `0 8px 24px -12px rgba(0,0,0,.6)` | `… rgba(14,26,36,.25)` | Toast only |

Each accent also has a `--X-rgb` triplet for `rgba()` tints.
`theme-color` meta values: dark `#0E1A24`, light `#F4F7F8` (`theme.js` updates them).

## Shape

| Token | Value | Used on |
|---|---|---|
| `--radius-sm` | 8px | nav links, segments, skip link |
| `--radius` | 12px | inputs, callouts, choice rows, toast |
| `--radius-lg` | 16px | cards, readouts |
| (literal) | 10px | buttons, icon tiles |
| (literal) | 14px | link rows, product tiles |
| `--radius-pill` | 999px | chips, offline badge |

## Sizing

| Token | Value |
|---|---|
| `--tap` | 44px minimum touch target (Apple HIG) |
| `--nav-h` | 52px |
| `--shell-w` | 420px (landing page 440, desktop 760) |
| `--shell-pad` | 16px (landing page 20) |

## Type

The font stack is `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`; mono is
`ui-monospace, 'SF Mono', Menlo, monospace`.

| Role | Size / weight | Extra |
|---|---|---|
| Eyebrow / label | 11 / 700 | uppercase, 1.5px tracking, muted or teal |
| Fine print | 10.5–11 | `--text-faint` |
| Secondary | 11.5–12.5 | muted |
| Body | 13–13.5, line-height 1.5–1.6 | `--text-soft` in cards |
| Row title / button | 13–14 / 700 | |
| Question | 15, lh 1.5 | |
| Card title | 16 / 800 | |
| Hero brand | 32 / 800 (40 on desktop) | −0.5px tracking, accent `span` in green |
| Big number | 36–44 / 700, lh 1 | green; unit in 16–18 muted |

## Motion
- Hover and border changes use `.15s ease`, chevrons `.2s`, progress fills `.4s`.
- The live `.dot` pulses on a 1.6s loop; it is the only looping animation.
- Everything collapses to 0.01ms under `prefers-reduced-motion`.
