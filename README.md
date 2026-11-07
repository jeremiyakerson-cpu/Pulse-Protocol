<div align="center">

<img src="icons/icon-192.png" width="96" alt="Pulse & Protocol icon">

# Pulse & Protocol

**Free ER nursing study tools, built by a practicing ER nurse. They install to your phone and work offline.**

[**Open the live site →**](https://jeremiyakerson-cpu.github.io/Pulse-Protocol/)

![No build step](https://img.shields.io/badge/build-none-2ea44f)
![Offline PWA](https://img.shields.io/badge/PWA-offline--ready-0aa)
![WCAG AA](https://img.shields.io/badge/a11y-WCAG%20AA-blue)
![Vanilla JS](https://img.shields.io/badge/stack-HTML%20%2F%20CSS%20%2F%20JS-f7df1e)

</div>

---

## Why this exists

I've spent nearly ten years in the ER and critical care, much of it as a charge nurse. The study resources
newer ER nurses get are usually locked behind paywalls, slow on a hospital phone, or useless in a
dead zone. Pulse & Protocol is the reference I wished I had: fast, free, and still working when
the Wi-Fi in the back hallway doesn't.

## What's inside

| Tool | What it does |
| --- | --- |
| **ER Dosing Reference** (`calculator.html`) | Adult fixed-dose and pediatric weight-based dosing for common resuscitation drugs, plus a vitals reference table by age |
| **ER Study Monitor** (`quiz.html`) | Case-based ER questions with score, streak and a breakdown by category, so you can see where to study next |
| **Landing page** (`index.html`) | The tools, install/offline help, about the author, shop and newsletter links |

### Built for real bedside conditions

- **Works offline.** A service worker caches the whole site on the first visit, and a 4-second network timeout falls back to the cached copy.
- **Installs like an app.** It's a PWA on iOS, Android and desktop, with an update notice that never reloads mid-quiz.
- **Accessible.** Contrast meets WCAG AA in light and dark themes, tap targets are 44px or larger, it works with a keyboard, a screen reader and reduced motion, and layouts hold down to 320px.
- **No dependencies.** It's plain HTML, CSS and JavaScript, with nothing to install and nothing to break.

> **Educational use only.** Nothing here is for real-time clinical dosing decisions. Always confirm
> against your facility's current protocols and pharmacy references.

## About the author

**Jeremi Yakerson, BSN, RN.** I'm an ER nurse with nearly 10 years in emergency and critical care,
including work as a charge nurse and psychiatric liaison in a 55-bed ED. I build clinical education
and clinical-reasoning tools at the intersection of nursing and software.

- Related: [CEN EKG Rhythm Trainer](https://github.com/jeremiyakerson-cpu/work-flow), a rhythm-recognition and scenario trainer with automated content tests
- Shop: [shoprn14 on Etsy](https://shoprn14.etsy.com)

Feedback from nurses, educators and students is welcome. [Open an issue](https://github.com/jeremiyakerson-cpu/Pulse-Protocol/issues) with corrections or requests.

---

# For developers

## Project layout

```
index.html              landing page
calculator.html         dosing reference (logic + data inline)
quiz.html               study quiz (logic + questions inline)
css/pulse.css           shared design system: tokens, base, nav, accessibility helpers
css/home.css            landing-page styles
css/calculator.css      calculator styles
css/quiz.css            quiz styles
js/theme.js             light/dark theme (system preference + saved choice), nav toggle
js/pwa.js               service worker registration, update notice, install button, "Offline" badge
sw.js                   service worker (offline precache)
manifest.webmanifest    PWA manifest (name, colours, icons, shortcuts)
icons/                  app icons (SVG sources + generated PNGs)
.github/workflows/pages.yml       deploys main to GitHub Pages
.github/scripts/check-precache.js checks every sw.js precache file exists
```

It's plain HTML, CSS and JavaScript: no build step, no dependencies, no framework.

### Design tokens

Colours, radii, fonts and the minimum tap-target size are CSS custom properties on `:root` in
`css/pulse.css` (for example `--bg`, `--surface`, `--border`, `--text-muted`, `--green`, `--teal`,
`--amber`, `--red`, `--tap`). Use the tokens in new styles instead of hard-coded hex values. Put
page-specific rules in that page's stylesheet and anything shared in `pulse.css`.

### Light and dark theme

The site follows the system light/dark setting. The sun/moon button in the nav overrides it, and
the choice is saved in `localStorage` (choosing the theme that matches the system clears the
override, so the site goes back to following the OS). `js/theme.js` loads in `<head>` without
`defer` so the theme is applied before first paint; it writes the effective theme to
`<html data-theme="light|dark">`, and `css/pulse.css` redefines the tokens under
`:root[data-theme="light"]`. The light accents are darker so they still meet WCAG AA.

Styling through tokens is all a new page needs to support both themes. Some calculator/quiz markup
still carries hard-coded dark colours in `style=""`; `pulse.css` remaps those specific values in
light mode. Prefer tokens or classes over inline colours in new code.

### Accessibility

- A sticky top nav appears on every page, and the current page is marked with `aria-current`.
- A "Skip to content" link is the first thing you reach with the keyboard.
- A visible `:focus-visible` ring shows keyboard focus, and interactive controls are at least 44px
  tall.
- Text colours meet WCAG AA contrast in both the dark and light themes.
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

### GitHub Pages (automatic)

`.github/workflows/pages.yml` publishes the site on every push to `main` (and on demand from the
Actions tab via *Run workflow*). It copies only the site files into the artifact (no `.github`,
tests or docs), stamps `CACHE_VERSION` in `sw.js` with the commit SHA so visitors' offline copy
refreshes on every deploy, and fails the deploy if a file in the service worker's `PRECACHE` list
is missing.

**One-time setup (repository owner):** go to **Settings → Pages → Build and deployment → Source**
and choose **GitHub Actions**. Until this is set, the deploy job fails with a "Pages site not
found" / 404 error. The first run after that publishes to
`https://<user>.github.io/Pulse-Protocol/` (the URL is also shown on the workflow run and in
Settings → Pages). If you add a new top-level folder the site needs, add it to the `cp` line in
the workflow.

### Other hosts

The site is fully static, so deploy the repository root as-is. All paths are relative, so it works
from a domain root or a sub-path.

**Netlify:** "Add new site" → import the repo, leave the build command empty and set the publish
directory to `.`. You can also drag the folder onto https://app.netlify.com/drop.

Any other static host (Cloudflare Pages, Vercel, S3) works the same way. HTTPS is required for the
app to install and work offline. These hosts don't stamp the cache version, so bump
`CACHE_VERSION` by hand (see *Releasing changes*).

## Offline and install (PWA)

- `sw.js` precaches every page, stylesheet, script and icon on first visit. After that, the whole
  site works with no connection.
- **Pages** load network-first: when you're online you always get the latest content, and when
  you're offline you get the cached copy. **Assets** (CSS/JS/icons) load from the cache and refresh
  in the background.
- If the network hangs for more than 4 seconds on a page that's already cached, the cached copy is
  shown instead, so a dead-zone connection doesn't leave you on a blank screen.
- On first install a short "Saved for offline use" notice appears. When a new version is deployed,
  it installs in the background and a **"A new version is ready — Reload"** notice appears (the
  page doesn't reload by itself, so a quiz in progress isn't lost). An app left open all shift
  checks for updates when it comes back to the foreground, at most once an hour.
- **Install:** on Android/desktop Chrome and Edge, the landing page shows an **Install app**
  button (browser menu → *Install app* also works). On iOS Safari, use
  *Share → Add to Home Screen*. The landing page shows that hint on iOS.

### Releasing changes

When you change or add any precached file:

1. Add new files to the `PRECACHE` list in `sw.js`. Every file there must exist: one 404 fails the
   install and turns offline mode off. `node .github/scripts/check-precache.js` checks this, and
   the Pages workflow runs it before deploying. Files listed in `PRECACHE_OPTIONAL` are cached if
   present and skipped if not. They're the calculator/quiz `js/` files from the content PR, and
   they should move into `PRECACHE` once that PR is on `main`.
2. On GitHub Pages, that's it: the workflow stamps a new `CACHE_VERSION`. On other hosts, bump
   `CACHE_VERSION` in `sw.js` (for example `'v2'` → `'v3'`).

The new service worker installs, deletes old `pulse-protocol-*` caches, takes over open pages
and shows the reload notice.

## Disclaimer

All clinical scenarios are fictionalized or composites, for educational purposes. Not affiliated
with any employer or healthcare institution.
