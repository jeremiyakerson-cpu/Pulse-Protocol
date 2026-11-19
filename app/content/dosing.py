"""Static dosing reference table (the only source of weight-based doses).

Provenance model
----------------
Every entry carries `verified` and `signoff`. An entry is releasable only when
`verified` is True AND `signoff` names the pharmacist and date. The release
checker (tools/release_check.js) refuses to pass while any entry is unverified.

All entries below were transcribed by Claude from commonly published
pediatric resuscitation and ED references and are UNVERIFIED. They need
pharmacist sign-off, clinician review and pediatric age-banding review before
release. Do not treat any value here as checked.

Heparin is deliberately excluded (nomograms vary by site). See EXCLUDED.
"""

PENDING = "Transcribed by Claude, not yet checked against a formulary"

DOSING = [
    dict(id="epi-arrest", drug="Epinephrine", indication="Pulseless arrest",
         route="IV/IO", per_kg=0.01, unit="mg", max_dose=1, conc=0.1, conc_label="0.1 mg/mL",
         repeat="Every 3 to 5 min during arrest", min_kg=0, age_note="All ages; adult dose is the cap.",
         source="AHA PALS 2020 (transcribed)", notes="Check the concentration on the syringe; two strengths are stocked."),
    dict(id="epi-anaphylaxis", drug="Epinephrine", indication="Anaphylaxis",
         route="IM, anterolateral thigh", per_kg=0.01, unit="mg", max_dose=0.5, conc=1, conc_label="1 mg/mL",
         repeat="Every 5 to 15 min if no response", min_kg=0,
         age_note="Many pediatric protocols cap a child at 0.3 mg. Age-banding review needed.",
         source="WAO 2020 / AHA (transcribed)", notes="IM, not IV push, outside of arrest."),
    dict(id="amiodarone-arrest", drug="Amiodarone", indication="Pulseless VF / pVT",
         route="IV/IO bolus", per_kg=5, unit="mg", max_dose=300, conc=50, conc_label="50 mg/mL",
         repeat="May repeat up to 3 total doses (pediatric)", min_kg=0, age_note="Adult first dose is 300 mg.",
         source="AHA PALS 2020 (transcribed)", notes=""),
    dict(id="adenosine", drug="Adenosine", indication="SVT, first dose",
         route="Rapid IV push with flush", per_kg=0.1, unit="mg", max_dose=6, conc=3, conc_label="3 mg/mL",
         repeat="Second dose 0.2 mg/kg, max 12 mg", min_kg=0, age_note="",
         source="AHA PALS 2020 (transcribed)", notes="Use the port closest to the heart. Expect brief asystole."),
    dict(id="atropine-brady", drug="Atropine", indication="Bradycardia (vagal or AV block)",
         route="IV/IO", per_kg=0.02, unit="mg", max_dose=0.5, conc=0.1, conc_label="0.1 mg/mL",
         repeat="May repeat once", min_kg=0, age_note="Older PALS editions listed a 0.1 mg minimum dose. Flag: version conflict.",
         source="AHA PALS 2020 (transcribed)", notes=""),
    dict(id="naloxone", drug="Naloxone", indication="Opioid toxicity, full reversal",
         route="IV/IO/IM", per_kg=0.1, unit="mg", max_dose=2, conc=0.4, conc_label="0.4 mg/mL",
         repeat="Every 2 to 3 min as needed", min_kg=0,
         age_note="Lower titrated doses are used when the goal is breathing, not full reversal.",
         source="AHA PALS 2020 (transcribed)", notes="Watch for re-sedation; naloxone wears off before many opioids."),
    dict(id="lorazepam", drug="Lorazepam", indication="Status epilepticus",
         route="IV", per_kg=0.1, unit="mg", max_dose=4, conc=2, conc_label="2 mg/mL",
         repeat="May repeat once after 5 to 10 min", min_kg=0, age_note="",
         source="AES 2016 guideline (transcribed)", notes="Have bag-valve-mask ready. Respiratory depression risk."),
    dict(id="dextrose-d10", drug="Dextrose 10%", indication="Hypoglycemia",
         route="IV/IO", per_kg=0.5, unit="g", max_dose=25, conc=0.1, conc_label="0.1 g/mL (D10)",
         repeat="Recheck glucose in 15 min", min_kg=0, age_note="D10 preferred in children; concentrations above D25 are avoided peripherally in kids.",
         source="AHA PALS 2020 (transcribed)", notes="0.5 g/kg of D10 is 5 mL/kg."),
    dict(id="ondansetron", drug="Ondansetron", indication="Nausea and vomiting",
         route="IV/PO", per_kg=0.15, unit="mg", max_dose=4, conc=2, conc_label="2 mg/mL (IV)",
         repeat="Every 8 h as needed", min_kg=8, age_note="Typically 6 months and older. Age-banding review needed.",
         source="Common ED reference (transcribed)", notes="QT prolongation risk."),
    dict(id="acetaminophen", drug="Acetaminophen", indication="Fever or pain",
         route="PO", per_kg=15, unit="mg", max_dose=1000, conc=32, conc_label="160 mg/5 mL",
         repeat="Every 4 to 6 h, max 5 doses in 24 h", min_kg=0,
         age_note="Under 12 weeks: provider evaluation for fever before dosing.",
         source="Common pediatric reference (transcribed)", notes="Check combination cold products for hidden acetaminophen."),
    dict(id="ibuprofen", drug="Ibuprofen", indication="Fever or pain",
         route="PO", per_kg=10, unit="mg", max_dose=400, conc=20, conc_label="100 mg/5 mL",
         repeat="Every 6 to 8 h", min_kg=5, age_note="6 months and older only. Avoid in dehydration.",
         source="Common pediatric reference (transcribed)", notes="Give with food."),
    dict(id="ns-bolus", drug="Isotonic crystalloid", indication="Shock, fluid bolus",
         route="IV/IO", per_kg=20, unit="mL", max_dose=1000, conc=None, conc_label="",
         repeat="Reassess after each bolus", min_kg=0,
         age_note="PALS 2020 lists 10 to 20 mL/kg. Use 10 mL/kg in suspected cardiogenic shock or DKA. Flag: version conflict.",
         source="AHA PALS 2020 (transcribed)", notes="Reassess lungs and liver edge after each bolus."),
]

for d in DOSING:
    d.setdefault("verified", False)
    d.setdefault("signoff", None)
    d.setdefault("provenance", PENDING)

EXCLUDED = [
    dict(drug="Heparin", reason="Weight-based nomograms vary by site. Use your facility's protocol; this app will not calculate it."),
]
