# Pulse & Protocol mobile app (v13) and brand

## What this is
The Pulse & Protocol brand and its mobile app (v13): Test, Index and Calculators tabs. Also holds the brand's business side (Etsy ShopRN14, Pinterest, Pin Content Generator, short-form video).

Part of the Pulse & Protocol nursing education work. Jeremi owns clinical accuracy and scope. Claude owns structure, implementation and verification.

## Principles that apply here
- **Commit before the reveal.** The learner makes their own clinical judgment before any answer or AI output is shown.
- All clinical content is fictional or composite. Never real patient data (Florida Board of Nursing social media policy).
- Weight-based dosing comes only from a static vetted reference table. Heparin is excluded from live calculators because nomograms vary by site.
- Staged multiple choice, not free-text, for differential questions. Do not regress this.
- Mix simple urgent-care cases with complex deterioration cases.
- Rationales must explain why wrong answers are wrong. Flag guideline changes and version conflicts (for example ESI v4 vs v5).
- Five licensed clinical scales were replaced with descriptive reference cards. Keep it that way unless licensing is cleared.

Full list: `docs/shared-standards.md`.

## Release gates
- Pharmacist sign-off on dosing entries before release
- Clinician review of dosing reference and answer keys
- Pediatric age-banding review

## Visual rules
Use `pulse-ios-design` for app screens and `design-4-me` for brand pieces. Prefer HTML over JSX on iOS.

## Read first
`docs/pulse-protocol-app.md`, `docs/shared-standards.md`, `docs/engineering-patterns.md`
