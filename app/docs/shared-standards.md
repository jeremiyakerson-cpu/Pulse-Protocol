# Pulse & Protocol shared standards

Applies to every nursing education tool. Jeremi owns clinical accuracy and scope. Claude owns structure, implementation and verification.

## Non-negotiable principles
1. **Commit before the reveal.** The learner makes their own clinical judgment before any answer or AI output is shown.
2. All clinical content is fictional or composite. Never real patient data (Florida Board of Nursing social media policy).
3. Weight-based dosing comes only from a static vetted reference table. Heparin is excluded from live calculators because nomograms vary by site.
4. PHI detection triggers a non-dismissible hard lock before any network call.
5. Staged multiple choice, not free-text, for differential questions. Do not regress this.
6. Mix simple urgent-care cases with complex deterioration cases.
7. **PulseRef is educational material only, not clinical decision support** (decided 2026-10-09).
8. Rationales must explain why wrong answers are wrong. Flag guideline changes and version conflicts (for example ESI v4 vs v5).
9. Content must follow the **July 2026 BCEN outline**, not older versions.
10. Five licensed clinical scales were replaced with descriptive reference cards. Keep it that way unless licensing is cleared.

## Visual rules
Use the `pulse-ios-design` skill for app screens, `nursing-sheet-style` for printable sheets, `design-4-me` for brand pieces. For iOS, prefer HTML over JSX/React artifacts (the Claude iOS app renders JSX unreliably).

## Product infrastructure still open (all products)
Accounts, billing, API metering, CE accreditation, regulatory status of the dosing calculator.
