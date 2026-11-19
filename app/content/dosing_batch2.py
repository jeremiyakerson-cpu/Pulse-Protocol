"""Dosing entries, batch 2. Same provenance model as dosing.py: all UNVERIFIED."""
from dosing import PENDING

DOSING_2 = [
    dict(id="midazolam-in", drug="Midazolam", indication="Status epilepticus, no IV access",
         route="Intranasal (atomizer)", per_kg=0.2, unit="mg", max_dose=10, conc=5, conc_label="5 mg/mL",
         repeat="May repeat once per protocol", min_kg=0, age_note="Split the volume between nostrils.",
         source="AES 2016 guideline (transcribed)", notes="Respiratory depression risk. Have bag-valve mask ready."),
    dict(id="diphenhydramine", drug="Diphenhydramine", indication="Allergic reaction (adjunct)",
         route="IV/IM/PO", per_kg=1, unit="mg", max_dose=50, conc=50, conc_label="50 mg/mL",
         repeat="Every 6 h as needed", min_kg=0, age_note="Not for children under 2 without provider direction. Age-banding review needed.",
         source="Common ED reference (transcribed)", notes="Adjunct only. Never a substitute for epinephrine in anaphylaxis."),
    dict(id="dexamethasone-croup", drug="Dexamethasone", indication="Croup",
         route="PO/IM/IV", per_kg=0.6, unit="mg", max_dose=16, conc=4, conc_label="4 mg/mL",
         repeat="Single dose", min_kg=0, age_note="Some protocols use 0.15 mg/kg. Flag: protocol variation.",
         source="Common pediatric reference (transcribed)", notes=""),
    dict(id="calcium-chloride", drug="Calcium chloride 10%", indication="Hyperkalemia, hypocalcemia, CCB toxicity",
         route="IV/IO (central or large vein)", per_kg=20, unit="mg", max_dose=2000, conc=100, conc_label="100 mg/mL (10%)",
         repeat="Per provider", min_kg=0, age_note="Calcium gluconate is often preferred peripherally in children.",
         source="AHA PALS 2020 (transcribed)", notes="Severe tissue injury if it extravasates. Do not mix with bicarbonate."),
    dict(id="sodium-bicarbonate", drug="Sodium bicarbonate 8.4%", indication="Hyperkalemia or TCA toxicity",
         route="IV/IO slow push", per_kg=1, unit="mEq", max_dose=50, conc=1, conc_label="1 mEq/mL (8.4%)",
         repeat="Per provider", min_kg=0, age_note="Dilute to 4.2% (0.5 mEq/mL) in infants.",
         source="AHA PALS 2020 (transcribed)", notes="Flush between bicarbonate and calcium or catecholamines."),
    dict(id="ketorolac", drug="Ketorolac", indication="Moderate pain",
         route="IV/IM", per_kg=0.5, unit="mg", max_dose=15, conc=15, conc_label="15 mg/mL",
         repeat="Every 6 h, max 5 days", min_kg=0, age_note="Some references allow up to 30 mg. Flag: version conflict. Avoid in renal impairment, bleeding risk, late pregnancy.",
         source="Common ED reference (transcribed)", notes="Doses above 15 mg add little analgesia and more risk."),
]
for d in DOSING_2:
    d.setdefault("verified", False); d.setdefault("signoff", None); d.setdefault("provenance", PENDING)
