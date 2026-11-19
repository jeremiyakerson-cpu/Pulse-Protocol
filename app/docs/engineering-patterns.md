# Engineering patterns that worked (nursing education builds)

## Validation harness
A single Node script that accumulates every bug and prints them all at the end, never throwing on the first error. One run surfaces everything.

## JSX in Node
Only the pure-logic region of a JSX artifact can be run through Node. Pattern: extract the logic region, append `module.exports`, validate in Node. Full JSX fails on syntax.

## Content generation at scale
Author case data as Python dicts, serialize to JSON as a checkpoint, then emit JavaScript through dedicated emitter functions. This keeps authoring bugs separate from serialization bugs.

## Array insertion
Find the closing `];` by searching forward from the domain's opening brace, not globally. Always grep for a double comma after insertion.

## Patching bundled HTML
Exact string replace with `assert count == expected` before writing. Prevents silently patching the wrong place.

## Tests
Use invariant-based assertions, not hard-coded counts that break on every content update.

## Hosting from iOS
GitHub Pages from iPhone: Safari with "Request Desktop Website", upload files rather than editing in place (editing strips CSS). Playtest apps from a home-screen icon.

## Stack summary
- React 19 / JSX single-file artifacts for the suite builds, HTML for Etsy and GitHub Pages products
- Node.js for harnesses, Python for authoring, ReportLab for PDFs
- Capacitor for iOS packaging later
- Canva for polished infographic products
- Excalidraw MCP only gives a hand-drawn look
- Anthropic API (claude-sonnet-4-6) powers the Pin Content Generator
