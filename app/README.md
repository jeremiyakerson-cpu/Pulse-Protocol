# Pulse & Protocol app (v13.1 draft rebuild)

Offline, single-file nursing education app: **Test**, **Index**, **Calculators**.
Built with the `pulse-ios-design` system. Plain HTML/JS, no framework, no network calls.

## Build and check
```
python3 tools/build.py        # author content -> build/content.json -> dist/
node tools/validate.js        # invariant harness, reports every problem at once
node tools/release_check.js   # release gate, exits 1 while blockers are open
```
`dist/index.html` is the full page (GitHub Pages, Home Screen, Capacitor). `dist/artifact.html` is the claude.ai Artifact fragment.

## Layout
- `content/*.py`: cases, index entries, dosing table (Python dicts, the authoring source)
- `src/js/logic.js`: pure logic (dose math, MAP, Parkland, drip rate, commit/reveal state), loaded by the app and by Node
- `src/js/app.js`: UI and routing (`#test`, `#index`, `#calc`, `#case-<id>`, `#entry-<id>`)
- `src/css/pulse.css`, `components.css`, `js/theme.js`: copied verbatim from `pulse-ios-design`
- `release-gates.json`: clinician review, pediatric age-banding, BCEN mapping

## Status
All clinical content is a Claude-written draft for clinical review. Every dosing entry is `verified: false`.
