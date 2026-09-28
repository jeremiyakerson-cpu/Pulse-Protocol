# Pulse & Protocol

ER-tested nursing education, built for the bedside. A small static site written by a practicing
ER nurse, with free study tools that install to your phone and work offline.

| Page | What it is |
| --- | --- |
| `index.html` | Landing page: about, free tools, shop and newsletter links |
| `calculator.html` | **ER Dosing Reference**: adult fixed-dose and pediatric weight-based dosing for common resuscitation drugs, plus a vitals reference table |
| `quiz.html` | **ER Study Monitor**: a case-based ER quiz with score, streak and a per-category breakdown |

> **Educational use only.** Nothing here is for real-time clinical dosing decisions. Always confirm
> against your facility's current protocols and pharmacy references.

## Project layout

```
index.html              landing page
calculator.html         dosing reference (logic + data inline)
quiz.html               study quiz (logic + questions inline)
css/pulse.css           shared design system: tokens, base, nav, accessibility helpers
css/home.css            landing-page styles
css/calculator.css      calculator styles
css/quiz.css            quiz styles
js/pwa.js               registers the service worker, toggles the "Offline" badge
sw.js                   service worker (offline precache)
manifest.webmanifest    PWA manifest (name, colours, icons, shortcuts)
icons/                  app icons (SVG sources + generated PNGs)
```

It's plain HTML, CSS and JavaScript: no build step, no dependencies, no framework.

### Design tokens

Colours, radii, fonts and the minimum tap-target size are CSS custom properties on `:root` in
`css/pulse.css` (for example `--bg`, `--surface`, `--border`, `--text-muted`, `--green`, `--teal`,
`--amber`, `--red`, `--tap`). Use the tokens in new styles instead of hard-coded hex values. Put
page-specific rules in that page's stylesheet and anything shared in `pulse.css`.

### Accessibility

- A sticky top nav appears on every page, and the current page is marked with `aria-current`.
- A "Skip to content" link is the first thing you reach with the keyboard.
- A visible `:focus-visible` ring shows keyboard focus, and interactive controls are at least 44px
  tall.
- Text colours meet WCAG AA contrast on the dark background.
- With `prefers-reduced-motion`, the animations (pulse dot, progress bars) turn off.
- Layouts work down to 320px wide, and inputs use 16px text on touch devices so iOS doesn't zoom
  in on focus.

## Run locally

Any static file server works. The service worker only registers on `https://` or `localhost`,
so opening the files directly with `file://` shows the pages without offline support.

```sh
# Python
python3 -m http.server 8000
# or Node
npx serve .
```

Then open http://localhost:8000.

## Deploy

The site is fully static, so deploy the repository root as-is. All paths are relative, so it works
from a domain root or a sub-path such as `https://<user>.github.io/Pulse-Protocol/`.

**GitHub Pages:** Settings → Pages → *Deploy from a branch* → `main` / `(root)`.

**Netlify:** "Add new site" → import the repo, leave the build command empty and set the publish
directory to `.`. You can also drag the folder onto https://app.netlify.com/drop.

Any other static host (Cloudflare Pages, Vercel, S3) works the same way. HTTPS is required for the
app to install and work offline.

## Offline and install (PWA)

- `sw.js` precaches every page, stylesheet, script and icon on first visit. After that, the whole
  site works with no connection.
- **Pages** load network-first: when you're online you always get the latest content, and when
  you're offline you get the cached copy. **Assets** (CSS/JS/icons) load from the cache and refresh
  in the background.
- On Android/Chrome, use *Install app*. On iOS Safari, use *Share → Add to Home Screen*.

### Releasing changes

When you change or add any precached file:

1. Add new files to the `PRECACHE` list in `sw.js`.
2. Bump `CACHE_VERSION` in `sw.js` (for example `'v1'` → `'v2'`).

The new service worker installs, deletes old `pulse-protocol-*` caches and takes over on the next
load.

## Disclaimer

All clinical scenarios are fictionalized or composites, for educational purposes. Not affiliated
with any employer or healthcare institution.
