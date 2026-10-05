# Pulse & Protocol

ER-tested nursing education, built for the bedside. A small static site written by a practicing
ER nurse, with free study tools that install to your phone and work offline.

| Page | What it is |
| --- | --- |
| `index.html` | Landing page: the two tools, offline/install, about the author, shop and newsletter links |
| `calculator.html` | **ER Dosing Reference**: adult fixed-dose and pediatric weight-based dosing for common resuscitation drugs, plus a vitals reference table |
| `quiz.html` | **ER Study Monitor**: a case-based ER quiz with score, streak and a per-category breakdown |

> **Educational use only.** Nothing here is for real-time clinical dosing decisions. Always confirm
> against your facility's current protocols and pharmacy references.

## Project layout

```
index.html              landing page
calculator.html         dosing reference (search, favorites, recents, remembered weight)
quiz.html               study quiz (logic + questions inline)
css/pulse.css           shared design system: tokens, base, nav, accessibility helpers
css/home.css            landing-page styles
css/calculator.css      calculator styles
css/quiz.css            quiz styles
js/theme.js             light/dark theme (system preference + saved choice), nav toggle
js/pwa.js               service worker registration, "new version — Reload" banner, install button, "Offline" badge
js/dosing.js            dose math + weight/unit validation (pure, unit-tested)
js/drugs.js             drug reference data
js/calcprefs.js         calculator memory (favorites, recents, kg/lb, remembered patient) + search
js/content.js           content stamp: content version, data-updated date, clinical review status
tests/                  node --test tests/*.test.js
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
tests or docs), runs the test suite first (a failing test blocks the deploy), stamps `CACHE_VERSION` in `sw.js` with the commit SHA so visitors' offline copy
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
  it installs in the background and **waits**; a **"New version available — Reload"** banner
  appears under the nav on every page. Reload switches to the new version; *Later* hides the
  banner for that page view (the page never reloads by itself, so a quiz or calculation in
  progress isn't lost). If nobody clicks Reload, the update applies once every app tab is closed.
  An app left open all shift checks for updates when it comes back to the foreground or back
  online, at most once an hour.
- **Install:** on Android/desktop Chrome and Edge, the landing page shows an **Install app**
  button (browser menu → *Install app* also works). On iOS Safari, use
  *Share → Add to Home Screen*. The landing page shows that hint on iOS.

### Releasing changes

When you change or add any precached file:

1. Add new files to the `PRECACHE` list in `sw.js`. Every file there must exist: one 404 fails the
   install and turns offline mode off. `node .github/scripts/check-precache.js` checks this, and
   the Pages workflow runs it before deploying. Files listed in `PRECACHE_OPTIONAL` are cached if
   present and skipped if not. `tests/content.test.js` also fails if a page loads a `js/` or `css/`
   file that isn't precached.
2. On GitHub Pages, that's it: the workflow stamps a new `CACHE_VERSION`. On other hosts, bump
   `CACHE_VERSION` in `sw.js` (for example `'v2'` → `'v3'`).

The new service worker installs, waits, and shows the reload banner; once it takes over it deletes
old `pulse-protocol-*` caches.

### Updating drug content

`js/content.js` holds the content stamp shown under the calculator and in the home-page footer:
`CONTENT_VERSION`, `DATA_UPDATED` and `REVIEW` (clinical sign-off status). `tests/content.test.js`
fingerprints `js/drugs.js`, so any change to drug data fails the tests until you update
`DATA_UPDATED`, `DATA_FINGERPRINT` (the test prints the new value) and `CONTENT_VERSION`, and
reset `REVIEW` to pending unless the change was clinically signed off. Each drug's "Guideline year"
is read from the years written in its own `source` text; when none is written the calculator says
the year isn't recorded rather than guessing.

## Dosing calculator: memory and safety

- **Search** (word starts across name, group and abbreviation: `epi ana`, `txa`), **favorites**
  (☆ next to the drug) and **recent** drugs (last 5) are stored on the device only. The last drug
  used opens next time.
- **Remembered weight:** the weight (as typed, with its kg/lb unit and adult/peds mode) is kept on
  the device. A **Clear** button sits next to it. After 15 minutes without use the calculator hides
  doses and asks **"Is this still the same patient?"** (*Same patient* / *New patient — clear*);
  after 12 hours the weight is discarded.
- **kg/lb:** the toggle says which unit the typed number is in, and the line under the field shows
  the conversion so a misread unit is visible. The choice is remembered.
- **Validation:** non-numbers, zero/negatives and weights outside 0.4–350 kg show an error and no
  dose. Peds >100 kg, adult <30 kg and adult >150 kg (kg mode) ask for a kg/lb re-check. Drip
  orders 10× outside the reference range and custom bags 10× off the standard bags raise a
  "possible unit mismatch" alert. Max-dose caps show a red alert with the uncapped calculation.
- A **"Verify before giving"** strip is part of every readout and can't be dismissed.

## Disclaimer

All clinical scenarios are fictionalized or composites, for educational purposes. Not affiliated
with any employer or healthcare institution.
