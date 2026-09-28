/*
 * Pulse-Protocol drug reference data (education only — NOT for clinical use).
 *
 * Each drug:
 *   id, name, group            — group becomes an <optgroup> in the selector
 *   conc                       — display text for the usual concentration
 *   adult / peds               — a dose spec (below) or null when not listed
 *   note                       — clinical teaching note
 *   warnings                   — array of short safety warnings
 *   source                     — reference the numbers were checked against
 *   review                     — optional string: why a human should double-check this entry
 *
 * Dose spec types:
 *   { type: 'fixed',  dose: n | [lo, hi], unit, desc, perMl? }
 *   { type: 'weight', perKg: n | [lo, hi], unit, desc, min?, max?, perMl?, extras?: [{ label, perKg, max? }] }
 *   { type: 'tiered', unit, desc, tiers: [{ minKg?, maxKg?, overKg?, dose }] } (minKg/maxKg inclusive, overKg exclusive)
 *   { type: 'infusion', rateUnit, range: [lo, hi], start, desc, concs: [{ label, amount, unit, volumeMl }],
 *       bolus?: { perKg?, dose?, max?, unit, desc }, capPerHr? }             (capPerHr in rateUnit's amount per hr)
 *   { type: 'text', text, desc }
 *
 * perMl: concentration in the dose unit per mL, used to show the volume to draw up.
 * spec.conc (optional) overrides the drug-level conc text for that population.
 *
 * Rule for contributors: never add a number you cannot cite. If unsure, leave it out.
 */
(function (root) {
  'use strict';

  var DRUGS = [
    // ───────────── Cardiac arrest & ACLS/PALS ─────────────
    {
      id: 'epi_arrest', name: 'Epinephrine — Cardiac Arrest', group: 'Cardiac arrest',
      conc: '0.1 mg/mL (1 mg/10 mL prefilled syringe)',
      adult: { type: 'fixed', dose: 1, unit: 'mg', perMl: 0.1, desc: 'IV/IO push q3–5 min' },
      peds: { type: 'weight', perKg: 0.01, max: 1, unit: 'mg', perMl: 0.1, desc: 'IV/IO push q3–5 min (0.1 mL/kg of 0.1 mg/mL)' },
      note: 'Follow each dose with a 20 mL flush (adult) and limb elevation. In non-shockable rhythms give as soon as feasible.',
      warnings: ['Confirm 0.1 mg/mL before drawing up — confusing it with 1 mg/mL (anaphylaxis strength) is a well-documented high-alert error.'],
      source: 'AHA ACLS / PALS'
    },
    {
      id: 'amiodarone_arrest', name: 'Amiodarone — Pulseless VT/VF', group: 'Cardiac arrest',
      conc: '50 mg/mL',
      adult: { type: 'fixed', dose: 300, unit: 'mg', perMl: 50, desc: 'IV/IO push first dose; second dose 150 mg' },
      peds: { type: 'weight', perKg: 5, max: 300, unit: 'mg', perMl: 50, desc: 'IV/IO bolus; may repeat up to 3 total doses (15 mg/kg) for refractory VF/pVT' },
      note: 'Given for shock-refractory VF/pulseless VT (after the 3rd shock in the adult algorithm). Lidocaine is an acceptable alternative.',
      warnings: ['Hypotension and bradycardia are common after the bolus once ROSC is achieved.'],
      source: 'AHA ACLS / PALS'
    },
    {
      id: 'lidocaine_arrest', name: 'Lidocaine — Pulseless VT/VF', group: 'Cardiac arrest',
      conc: '20 mg/mL (100 mg/5 mL prefilled syringe)',
      adult: { type: 'weight', perKg: [1, 1.5], unit: 'mg', perMl: 20, desc: 'IV/IO first dose; then 0.5–0.75 mg/kg, max cumulative 3 mg/kg' },
      peds: { type: 'weight', perKg: 1, unit: 'mg', perMl: 20, desc: 'IV/IO loading dose' },
      note: 'Alternative to amiodarone for shock-refractory VF/pulseless VT.',
      warnings: ['Watch for toxicity (perioral numbness, seizures) with repeat dosing.'],
      source: 'AHA ACLS / PALS'
    },
    {
      id: 'defib', name: 'Defibrillation — VF / pulseless VT', group: 'Cardiac arrest',
      conc: 'Energy (joules)',
      adult: { type: 'fixed', dose: [120, 200], unit: 'J', desc: 'Biphasic, per manufacturer recommendation; if unknown use the maximum available. Subsequent shocks same or higher.' },
      peds: { type: 'weight', perKg: 2, unit: 'J', desc: 'First shock', extras: [{ label: 'Second shock (4 J/kg)', perKg: 4 }] },
      note: 'Pediatric subsequent shocks: ≥4 J/kg, maximum 10 J/kg or the standard adult dose. Resume CPR immediately after every shock.',
      warnings: ['Unsynchronized. Clear everyone and remove oxygen from the chest before shocking.'],
      source: 'AHA ACLS / PALS'
    },
    {
      id: 'bicarb', name: 'Sodium Bicarbonate 8.4%', group: 'Cardiac arrest',
      conc: '1 mEq/mL (8.4%)',
      adult: { type: 'weight', perKg: 1, unit: 'mEq', perMl: 1, desc: 'IV slow push' },
      peds: { type: 'weight', perKg: 1, unit: 'mEq', perMl: 1, desc: 'IV/IO slow push (use 4.2% = 0.5 mEq/mL in neonates/young infants)' },
      note: 'Not routine in cardiac arrest. Used for hyperkalemia, sodium-channel blocker (e.g., TCA) toxicity with wide QRS, and select metabolic acidosis.',
      warnings: ['Flush the line before/after — precipitates with calcium and inactivates catecholamines.', 'Extravasation causes tissue necrosis.'],
      source: 'AHA ACLS / PALS'
    },
    {
      id: 'calcium_chloride', name: 'Calcium Chloride 10%', group: 'Cardiac arrest',
      conc: '100 mg/mL (1 g/10 mL)',
      adult: { type: 'fixed', dose: 1, unit: 'g', perMl: 0.1, desc: 'IV slow push (10 mL of 10%)' },
      peds: { type: 'weight', perKg: 20, max: 1000, unit: 'mg', perMl: 100, desc: 'IV/IO slow push (0.2 mL/kg)' },
      note: 'For hyperkalemia with ECG changes, hypocalcemia, hypermagnesemia, and calcium-channel blocker toxicity. Not routine in arrest.',
      warnings: ['Very irritating — use a central line or large, secure vein. Extravasation causes necrosis.', 'Calcium chloride has ~3× the elemental calcium of calcium gluconate — do not substitute mL for mL.'],
      source: 'AHA PALS',
      review: 'Pediatric maximum single dose: capped here at the adult 1 g dose; some references list a 2 g maximum.'
    },

    // ───────────── Arrhythmias / bradycardia ─────────────
    {
      id: 'adenosine', name: 'Adenosine — SVT', group: 'Arrhythmia',
      conc: '3 mg/mL',
      adult: { type: 'fixed', dose: 6, unit: 'mg', perMl: 3, desc: 'Rapid IV push; second dose 12 mg if needed' },
      peds: { type: 'weight', perKg: 0.1, max: 6, unit: 'mg', perMl: 3, desc: 'Rapid IV/IO push (first dose)', extras: [{ label: 'Second dose (0.2 mg/kg, max 12 mg)', perKg: 0.2, max: 12 }] },
      note: 'Use the most proximal IV, push rapidly, and immediately follow with a rapid saline flush. Warn the patient about a brief sense of impending doom. Record a rhythm strip during the push.',
      warnings: ['Avoid in pre-excited atrial fibrillation (WPW) and irregular wide-complex tachycardia.'],
      source: 'AHA ACLS / PALS'
    },
    {
      id: 'atropine', name: 'Atropine — Symptomatic Bradycardia', group: 'Arrhythmia',
      conc: '0.1 mg/mL (1 mg/10 mL prefilled syringe)',
      adult: { type: 'fixed', dose: 1, unit: 'mg', perMl: 0.1, desc: 'IV q3–5 min, max total 3 mg' },
      peds: { type: 'weight', perKg: 0.02, min: 0.1, max: 0.5, unit: 'mg', perMl: 0.1, desc: 'IV/IO, may repeat once (min 0.1 mg, max single dose 0.5 mg)' },
      note: 'In pediatric bradycardia, oxygenation/ventilation and epinephrine come first; atropine is for increased vagal tone or primary AV block.',
      warnings: ['Adult dose was updated from 0.5 mg to 1 mg in the 2020 AHA guidelines.', 'Unlikely to work in denervated (transplanted) hearts or high-degree infranodal block — prepare pacing.'],
      source: 'AHA ACLS 2020 / PALS',
      review: 'Pediatric 0.1 mg minimum dose — retained from the PALS card; confirm your institution still applies it.'
    },
    {
      id: 'amiodarone_vt_pulse', name: 'Amiodarone — Stable VT (with pulse)', group: 'Arrhythmia',
      conc: '50 mg/mL (dilute for infusion)',
      adult: { type: 'fixed', dose: 150, unit: 'mg', desc: 'IV over 10 min; may repeat; then maintenance infusion 1 mg/min × 6 hr' },
      peds: { type: 'weight', perKg: 5, max: 300, unit: 'mg', desc: 'IV over 20–60 min' },
      note: 'For stable wide-complex tachycardia. Consult expert before combining with procainamide.',
      warnings: ['Causes hypotension and QT prolongation.'],
      source: 'AHA ACLS / PALS'
    },
    {
      id: 'procainamide', name: 'Procainamide — Stable wide-complex tachycardia', group: 'Arrhythmia',
      conc: '100 mg/mL or 500 mg/mL — verify vial',
      adult: { type: 'fixed', dose: [20, 50], unit: 'mg/min', desc: 'IV until arrhythmia suppressed, hypotension, QRS widens >50%, or max 17 mg/kg; maintenance 1–4 mg/min' },
      peds: null,
      note: 'Useful for stable monomorphic VT and pre-excited atrial fibrillation.',
      warnings: ['Avoid with prolonged QT or heart failure.'],
      source: 'AHA ACLS'
    },
    {
      id: 'magnesium_torsades', name: 'Magnesium Sulfate — Torsades', group: 'Arrhythmia',
      conc: '500 mg/mL (50%) — dilute',
      adult: { type: 'fixed', dose: [1, 2], unit: 'g', desc: 'IV/IO diluted, over 5–20 min in arrest (slower if pulse present)' },
      peds: { type: 'weight', perKg: [25, 50], max: 2000, unit: 'mg', desc: 'IV/IO over 10–20 min (faster in arrest)' },
      note: 'For torsades de pointes (polymorphic VT with long QT) and hypomagnesemia.',
      warnings: ['Rapid infusion causes hypotension and bradycardia; watch reflexes and respiratory rate.'],
      source: 'AHA ACLS / PALS'
    },
    {
      id: 'cardioversion', name: 'Synchronized Cardioversion', group: 'Arrhythmia',
      conc: 'Energy (joules)',
      adult: { type: 'text', text: 'Narrow regular: 50–100 J · Narrow irregular (AF): 120–200 J biphasic · Wide regular: 100 J · Wide irregular: defibrillation dose (NOT synchronized)', desc: 'Increase stepwise if unsuccessful; follow device manufacturer recommendations.' },
      peds: { type: 'weight', perKg: [0.5, 1], unit: 'J', desc: 'Synchronized, first attempt', extras: [{ label: 'If ineffective (2 J/kg)', perKg: 2 }] },
      note: 'For unstable tachycardia with a pulse. Sedate if time allows. Re-press SYNC after each shock on many devices.',
      warnings: ['Confirm sync markers are on the R waves, not T waves.'],
      source: 'AHA ACLS / PALS'
    },
    {
      id: 'diltiazem_bolus', name: 'Diltiazem — AF/flutter rate control (bolus)', group: 'Arrhythmia',
      conc: '5 mg/mL',
      adult: { type: 'weight', perKg: 0.25, unit: 'mg', perMl: 5, desc: 'IV over 2 min; if needed after 15 min, 0.35 mg/kg' },
      peds: null,
      note: 'Many ED protocols use a lower first dose (e.g., 0.15–0.2 mg/kg or a 10–20 mg fixed dose) in older or borderline-hypotensive patients.',
      warnings: ['Avoid in hypotension, decompensated HF with reduced EF, WPW with AF, and wide-complex tachycardia.'],
      source: 'Diltiazem prescribing information / AHA ACLS'
    },
    {
      id: 'metoprolol', name: 'Metoprolol — Rate control', group: 'Arrhythmia',
      conc: '1 mg/mL',
      adult: { type: 'fixed', dose: 5, unit: 'mg', perMl: 1, desc: 'IV over 1–2 min q5 min, max 15 mg' },
      peds: null,
      note: 'Beta-blocker for rate control in AF/flutter and narrow-complex tachycardia.',
      warnings: ['Avoid in decompensated heart failure, hypotension, bronchospasm, or cocaine-associated chest pain.'],
      source: 'Metoprolol prescribing information / AHA'
    },

    // ───────────── RSI & sedation ─────────────
    {
      id: 'etomidate', name: 'Etomidate — RSI induction', group: 'RSI & sedation',
      conc: '2 mg/mL',
      adult: { type: 'weight', perKg: 0.3, unit: 'mg', perMl: 2, desc: 'IV push' },
      peds: { type: 'weight', perKg: 0.3, unit: 'mg', perMl: 2, desc: 'IV push' },
      note: 'Hemodynamically neutral induction agent — a common choice in hypotensive patients.',
      warnings: ['Causes transient adrenal suppression; myoclonus is common and is not seizure activity.'],
      source: 'Walls Manual of Emergency Airway Management / prescribing information'
    },
    {
      id: 'ketamine_induction', name: 'Ketamine — RSI induction', group: 'RSI & sedation',
      conc: '10, 50, or 100 mg/mL — VERIFY VIAL',
      adult: { type: 'weight', perKg: [1, 2], unit: 'mg', desc: 'IV push' },
      peds: { type: 'weight', perKg: [1, 2], unit: 'mg', desc: 'IV push' },
      note: 'Preserves airway reflexes and respiratory drive; bronchodilator — good choice in asthma and shock (consider lower dose in profound shock).',
      warnings: ['Ketamine comes in three concentrations — a 10× error is easy. Confirm mg/mL before drawing up.', 'Emergence reactions; increases secretions.'],
      source: 'Walls Manual of Emergency Airway Management'
    },
    {
      id: 'propofol_induction', name: 'Propofol — Induction', group: 'RSI & sedation',
      conc: '10 mg/mL',
      adult: { type: 'weight', perKg: [1, 2.5], unit: 'mg', perMl: 10, desc: 'IV push — 2–2.5 mg/kg in healthy adults <55 yr; 1–1.5 mg/kg in elderly, debilitated, or ASA III–IV' },
      peds: { type: 'weight', perKg: [2.5, 3.5], unit: 'mg', perMl: 10, desc: 'IV push (age 3–16 yr, healthy)' },
      note: 'Rapid onset, short duration. Many ED physicians reduce the dose substantially in shock.',
      warnings: ['Causes significant hypotension and apnea — have pressors ready.'],
      source: 'Propofol prescribing information'
    },
    {
      id: 'succinylcholine', name: 'Succinylcholine — RSI paralytic', group: 'RSI & sedation',
      conc: '20 mg/mL',
      adult: { type: 'weight', perKg: 1.5, unit: 'mg', perMl: 20, desc: 'IV push' },
      peds: { type: 'weight', perKg: [1, 2], unit: 'mg', perMl: 20, desc: 'IV push (2 mg/kg for infants)' },
      note: 'Depolarizing agent: onset ~45–60 s, duration ~6–10 min.',
      warnings: [
        'Contraindicated: known/suspected hyperkalemia, personal/family history of malignant hyperthermia, burns/crush/denervation injuries >24–72 hr old, neuromuscular disease.',
        'Can cause bradycardia, especially in children and with repeat doses.'
      ],
      source: 'Walls Manual of Emergency Airway Management'
    },
    {
      id: 'rocuronium', name: 'Rocuronium — RSI paralytic', group: 'RSI & sedation',
      conc: '10 mg/mL',
      adult: { type: 'weight', perKg: [1, 1.2], unit: 'mg', perMl: 10, desc: 'IV push' },
      peds: { type: 'weight', perKg: [1, 1.2], unit: 'mg', perMl: 10, desc: 'IV push' },
      note: 'Non-depolarizing; duration 45–60+ min. Reversible with sugammadex.',
      warnings: ['Patient remains paralyzed long after induction wears off — start post-intubation sedation/analgesia promptly.'],
      source: 'Walls Manual of Emergency Airway Management'
    },
    {
      id: 'propofol_infusion', name: 'Propofol — Sedation infusion', group: 'RSI & sedation',
      conc: '10 mg/mL (undiluted)',
      adult: {
        type: 'infusion', rateUnit: 'mcg/kg/min', range: [5, 50], start: 5,
        concs: [{ label: '10 mg/mL (undiluted)', amount: 1000, unit: 'mg', volumeMl: 100 }],
        desc: 'Titrate by 5–10 mcg/kg/min q5–10 min to sedation goal'
      },
      peds: null,
      note: 'Post-intubation sedation. Pair with analgesia (analgesia-first sedation).',
      warnings: ['Hypotension. Monitor triglycerides; propofol infusion syndrome risk with high doses/long duration.', 'Lipid vehicle — change tubing per policy (strict aseptic technique).'],
      source: 'Propofol prescribing information / SCCM'
    },
    {
      id: 'fentanyl', name: 'Fentanyl — Analgesia', group: 'RSI & sedation',
      conc: '50 mcg/mL',
      adult: { type: 'weight', perKg: [0.5, 1], max: 100, unit: 'mcg', perMl: 50, desc: 'IV, titrate q5–10 min to effect' },
      peds: { type: 'weight', perKg: 1.5, max: 100, unit: 'mcg', perMl: 50, desc: 'Intranasal (split between nares)' },
      note: 'Short-acting opioid with minimal histamine release — preferred in hemodynamically tenuous patients.',
      warnings: ['Respiratory depression; rapid high doses can cause chest-wall rigidity. Keep naloxone available.'],
      source: 'Common ED protocols',
      review: 'Adult 0.5–1 mcg/kg with 100 mcg single-dose cap and pediatric IN 1.5 mcg/kg (max 100 mcg) reflect common ED protocols rather than a single guideline.'
    },

    // ───────────── Pressors & cardiac drips ─────────────
    {
      id: 'norepi', name: 'Norepinephrine drip', group: 'Pressors & drips',
      conc: '4 mg/250 mL (16 mcg/mL) or 8 mg/250 mL (32 mcg/mL)',
      adult: {
        type: 'infusion', rateUnit: 'mcg/min', range: [2, 12], start: 8,
        concs: [
          { label: '4 mg / 250 mL (16 mcg/mL)', amount: 4, unit: 'mg', volumeMl: 250 },
          { label: '8 mg / 250 mL (32 mcg/mL)', amount: 8, unit: 'mg', volumeMl: 250 }
        ],
        desc: 'Label: start 8–12 mcg/min, maintenance 2–4 mcg/min; titrate to MAP ≥65 (many protocols start lower and titrate)'
      },
      peds: {
        type: 'infusion', rateUnit: 'mcg/kg/min', range: [0.1, 2], start: 0.1,
        concs: [
          { label: '4 mg / 250 mL (16 mcg/mL)', amount: 4, unit: 'mg', volumeMl: 250 },
          { label: '8 mg / 250 mL (32 mcg/mL)', amount: 8, unit: 'mg', volumeMl: 250 }
        ],
        desc: 'Titrate to perfusion/BP'
      },
      note: 'First-line vasopressor for septic shock. Some institutions dose in mcg/kg/min for adults — match the units on the order.',
      warnings: ['Extravasation causes tissue necrosis — prefer central/large proximal line; phentolamine is the antidote.'],
      source: 'Norepinephrine prescribing information / Surviving Sepsis Campaign / AHA PALS'
    },
    {
      id: 'epi_drip', name: 'Epinephrine drip', group: 'Pressors & drips',
      conc: '1 mg/250 mL (4 mcg/mL) or 4 mg/250 mL (16 mcg/mL)',
      adult: {
        type: 'infusion', rateUnit: 'mcg/min', range: [2, 10], start: 2,
        concs: [
          { label: '1 mg / 250 mL (4 mcg/mL)', amount: 1, unit: 'mg', volumeMl: 250 },
          { label: '4 mg / 250 mL (16 mcg/mL)', amount: 4, unit: 'mg', volumeMl: 250 }
        ],
        desc: 'Symptomatic bradycardia / shock; titrate to response'
      },
      peds: {
        type: 'infusion', rateUnit: 'mcg/kg/min', range: [0.1, 1], start: 0.1,
        concs: [
          { label: '1 mg / 250 mL (4 mcg/mL)', amount: 1, unit: 'mg', volumeMl: 250 },
          { label: '4 mg / 250 mL (16 mcg/mL)', amount: 4, unit: 'mg', volumeMl: 250 }
        ],
        desc: 'Titrate to perfusion/BP'
      },
      note: 'Used for bradycardia unresponsive to atropine, anaphylactic shock, and cold/fluid-refractory shock in children.',
      warnings: ['Tachyarrhythmias and myocardial ischemia. Extravasation risk.'],
      source: 'AHA ACLS / PALS'
    },
    {
      id: 'dopamine', name: 'Dopamine drip', group: 'Pressors & drips',
      conc: '400 mg/250 mL or 800 mg/500 mL (1600 mcg/mL)',
      adult: {
        type: 'infusion', rateUnit: 'mcg/kg/min', range: [5, 20], start: 5,
        concs: [{ label: '400 mg / 250 mL (1600 mcg/mL)', amount: 400, unit: 'mg', volumeMl: 250 }],
        desc: 'Symptomatic bradycardia / shock; titrate to response'
      },
      peds: {
        type: 'infusion', rateUnit: 'mcg/kg/min', range: [2, 20], start: 5,
        concs: [{ label: '400 mg / 250 mL (1600 mcg/mL)', amount: 400, unit: 'mg', volumeMl: 250 }],
        desc: 'Titrate to response'
      },
      note: 'Largely replaced by norepinephrine in septic shock due to more arrhythmias.',
      warnings: ['Tachyarrhythmias. Extravasation causes necrosis.'],
      source: 'AHA ACLS / PALS'
    },
    {
      id: 'dobutamine', name: 'Dobutamine drip', group: 'Pressors & drips',
      conc: '250 mg/250 mL (1000 mcg/mL) or 500 mg/250 mL (2000 mcg/mL)',
      adult: {
        type: 'infusion', rateUnit: 'mcg/kg/min', range: [2, 20], start: 2.5,
        concs: [
          { label: '250 mg / 250 mL (1000 mcg/mL)', amount: 250, unit: 'mg', volumeMl: 250 },
          { label: '500 mg / 250 mL (2000 mcg/mL)', amount: 500, unit: 'mg', volumeMl: 250 }
        ],
        desc: 'Inotrope for cardiogenic shock / low output'
      },
      peds: {
        type: 'infusion', rateUnit: 'mcg/kg/min', range: [2, 20], start: 2.5,
        concs: [{ label: '250 mg / 250 mL (1000 mcg/mL)', amount: 250, unit: 'mg', volumeMl: 250 }],
        desc: 'Titrate to response'
      },
      note: 'Primarily increases contractility; may lower BP through vasodilation.',
      warnings: ['Tachycardia and arrhythmias; may worsen hypotension.'],
      source: 'Dobutamine prescribing information / AHA PALS'
    },
    {
      id: 'vasopressin', name: 'Vasopressin drip — septic shock', group: 'Pressors & drips',
      conc: '20 units/100 mL (0.2 units/mL)',
      adult: {
        type: 'infusion', rateUnit: 'units/min', range: [0.03, 0.04], start: 0.03,
        concs: [
          { label: '20 units / 100 mL (0.2 units/mL)', amount: 20, unit: 'units', volumeMl: 100 },
          { label: '40 units / 100 mL (0.4 units/mL)', amount: 40, unit: 'units', volumeMl: 100 }
        ],
        desc: 'Added to norepinephrine; not titrated like other pressors'
      },
      peds: null,
      note: 'Second-line agent added to norepinephrine to raise MAP or reduce norepinephrine dose.',
      warnings: ['Doses above 0.04 units/min are associated with ischemia (digital, mesenteric, cardiac).'],
      source: 'Surviving Sepsis Campaign'
    },
    {
      id: 'nitroglycerin', name: 'Nitroglycerin drip', group: 'Pressors & drips',
      conc: '50 mg/250 mL (200 mcg/mL)',
      adult: {
        type: 'infusion', rateUnit: 'mcg/min', range: [5, 200], start: 5,
        concs: [
          { label: '50 mg / 250 mL (200 mcg/mL)', amount: 50, unit: 'mg', volumeMl: 250 },
          { label: '25 mg / 250 mL (100 mcg/mL)', amount: 25, unit: 'mg', volumeMl: 250 }
        ],
        desc: 'Start 5 mcg/min, ↑ by 5 mcg/min q3–5 min to 20, then by 10–20 mcg/min'
      },
      peds: null,
      note: 'ACS with ongoing pain, hypertensive emergency with pulmonary edema.',
      warnings: ['Avoid with SBP <90, RV infarction, or PDE-5 inhibitor use (sildenafil/vardenafil within 24 hr, tadalafil within 48 hr).', 'Use non-PVC tubing.'],
      source: 'Nitroglycerin prescribing information / ACC/AHA'
    },
    {
      id: 'nicardipine', name: 'Nicardipine drip', group: 'Pressors & drips',
      conc: '20 mg/200 mL (0.1 mg/mL) or 40 mg/200 mL (0.2 mg/mL)',
      adult: {
        type: 'infusion', rateUnit: 'mg/hr', range: [5, 15], start: 5,
        concs: [
          { label: '20 mg / 200 mL (0.1 mg/mL)', amount: 20, unit: 'mg', volumeMl: 200 },
          { label: '40 mg / 200 mL (0.2 mg/mL)', amount: 40, unit: 'mg', volumeMl: 200 }
        ],
        desc: 'Start 5 mg/hr, ↑ 2.5 mg/hr q5–15 min, max 15 mg/hr'
      },
      peds: null,
      note: 'Titratable BP control, e.g., BP lowering around thrombolysis in stroke and in hemorrhagic stroke.',
      warnings: ['Reflex tachycardia. Change peripheral site per policy (phlebitis).'],
      source: 'Nicardipine prescribing information / AHA stroke guidelines'
    },
    {
      id: 'diltiazem_drip', name: 'Diltiazem drip', group: 'Pressors & drips',
      conc: '125 mg/125 mL (1 mg/mL)',
      adult: {
        type: 'infusion', rateUnit: 'mg/hr', range: [5, 15], start: 10,
        concs: [{ label: '125 mg / 125 mL (1 mg/mL)', amount: 125, unit: 'mg', volumeMl: 125 }],
        desc: 'After bolus; 10 mg/hr typical start (5 mg/hr in some), max 15 mg/hr'
      },
      peds: null,
      note: 'Maintains rate control after a diltiazem bolus in AF/flutter.',
      warnings: ['Hypotension; avoid in decompensated HFrEF.'],
      source: 'Diltiazem prescribing information'
    },
    {
      id: 'esmolol', name: 'Esmolol drip', group: 'Pressors & drips',
      conc: '2500 mg/250 mL (10 mg/mL)',
      adult: {
        type: 'infusion', rateUnit: 'mcg/kg/min', range: [50, 200], start: 50,
        concs: [{ label: '2500 mg / 250 mL (10 mg/mL)', amount: 2500, unit: 'mg', volumeMl: 250 }],
        bolus: { perKg: 500, unit: 'mcg', desc: 'Loading dose IV over 1 min' },
        desc: 'Titrate by 50 mcg/kg/min steps (re-bolus before each increase per label)'
      },
      peds: null,
      note: 'Ultra-short-acting beta-blocker (half-life ~9 min) — effects wear off quickly if stopped.',
      warnings: ['Hypotension and bradycardia; avoid in decompensated HF.'],
      source: 'Esmolol prescribing information'
    },
    {
      id: 'amiodarone_drip', name: 'Amiodarone drip', group: 'Pressors & drips',
      conc: '360 mg/200 mL (1.8 mg/mL) premix',
      adult: {
        type: 'infusion', rateUnit: 'mg/min', range: [0.5, 1], start: 1,
        concs: [
          { label: '360 mg / 200 mL (1.8 mg/mL)', amount: 360, unit: 'mg', volumeMl: 200 },
          { label: '150 mg / 100 mL (1.5 mg/mL)', amount: 150, unit: 'mg', volumeMl: 100 }
        ],
        desc: '1 mg/min × 6 hr, then 0.5 mg/min × 18 hr'
      },
      peds: null,
      note: 'Maintenance after bolus / ROSC.',
      warnings: ['Use an in-line filter and non-PVC tubing for prolonged infusions; hypotension, bradycardia, QT prolongation.'],
      source: 'Amiodarone prescribing information / AHA ACLS'
    },

    // ───────────── Anticoagulation, GI & endocrine drips ─────────────
    {
      id: 'heparin_vte', name: 'Heparin — VTE (weight-based)', group: 'Anticoag, GI & endocrine',
      conc: '25,000 units/250 mL (100 units/mL)',
      adult: {
        type: 'infusion', rateUnit: 'units/kg/hr', range: [18, 18], start: 18,
        concs: [
          { label: '25,000 units / 250 mL (100 units/mL)', amount: 25000, unit: 'units', volumeMl: 250 },
          { label: '25,000 units / 500 mL (50 units/mL)', amount: 25000, unit: 'units', volumeMl: 500 }
        ],
        bolus: { perKg: 80, unit: 'units', desc: 'IV bolus' },
        desc: 'Initial rate; then adjust by aPTT/anti-Xa nomogram'
      },
      peds: null,
      note: 'Raschke weight-based nomogram. Your facility nomogram governs titration.',
      warnings: ['High-alert medication — independent double-check required. Confirm vial strength (1,000 vs 5,000 vs 10,000 units/mL).'],
      source: 'Raschke nomogram / CHEST'
    },
    {
      id: 'heparin_acs', name: 'Heparin — ACS', group: 'Anticoag, GI & endocrine',
      conc: '25,000 units/250 mL (100 units/mL)',
      adult: {
        type: 'infusion', rateUnit: 'units/kg/hr', range: [12, 12], start: 12, capPerHr: 1000,
        concs: [
          { label: '25,000 units / 250 mL (100 units/mL)', amount: 25000, unit: 'units', volumeMl: 250 },
          { label: '25,000 units / 500 mL (50 units/mL)', amount: 25000, unit: 'units', volumeMl: 500 }
        ],
        bolus: { perKg: 60, max: 4000, unit: 'units', desc: 'IV bolus (max 4,000 units)' },
        desc: 'Initial rate, max 1,000 units/hr; then adjust by aPTT'
      },
      peds: null,
      note: 'ACS dosing is lower than VTE dosing.',
      warnings: ['High-alert medication — independent double-check required.'],
      source: 'ACC/AHA NSTE-ACS guideline'
    },
    {
      id: 'insulin_dka', name: 'Insulin (regular) — DKA drip', group: 'Anticoag, GI & endocrine',
      conc: '100 units/100 mL (1 unit/mL)',
      adult: {
        type: 'infusion', rateUnit: 'units/kg/hr', range: [0.1, 0.14], start: 0.1,
        concs: [{ label: '100 units / 100 mL (1 unit/mL)', amount: 100, unit: 'units', volumeMl: 100 }],
        desc: '0.1 units/kg/hr (after optional 0.1 units/kg bolus) or 0.14 units/kg/hr without bolus'
      },
      peds: {
        type: 'infusion', rateUnit: 'units/kg/hr', range: [0.05, 0.1], start: 0.1,
        concs: [{ label: '100 units / 100 mL (1 unit/mL)', amount: 100, unit: 'units', volumeMl: 100 }],
        desc: 'No bolus in children; start after initial fluid resuscitation has begun'
      },
      note: 'Add dextrose to fluids when glucose falls to ~250 mg/dL (adult) — keep the insulin running to close the anion gap.',
      warnings: ['Do NOT start insulin if K+ <3.3 mEq/L — replete potassium first.', 'High-alert medication — prime/waste tubing per policy (insulin adsorbs to tubing).'],
      source: 'ADA hyperglycemic crises consensus / ISPAD'
    },
    {
      id: 'pantoprazole', name: 'Pantoprazole — Upper GI bleed', group: 'Anticoag, GI & endocrine',
      conc: '80 mg/100 mL (0.8 mg/mL)',
      adult: {
        type: 'infusion', rateUnit: 'mg/hr', range: [8, 8], start: 8,
        concs: [{ label: '80 mg / 100 mL (0.8 mg/mL)', amount: 80, unit: 'mg', volumeMl: 100 }],
        bolus: { dose: 80, unit: 'mg', desc: 'IV bolus' },
        desc: 'Continuous infusion after 80 mg bolus (high-dose intermittent dosing is an accepted alternative)'
      },
      peds: null,
      note: 'For suspected peptic ulcer bleeding pending endoscopy.',
      warnings: [],
      source: 'ACG upper GI bleeding guideline'
    },
    {
      id: 'octreotide', name: 'Octreotide — Variceal bleed', group: 'Anticoag, GI & endocrine',
      conc: 'Per pharmacy mix — use Custom concentration',
      adult: {
        type: 'infusion', rateUnit: 'mcg/hr', range: [50, 50], start: 50,
        concs: [{ label: '500 mcg / 100 mL (5 mcg/mL)', amount: 500, unit: 'mcg', volumeMl: 100 }],
        bolus: { dose: 50, unit: 'mcg', desc: 'IV bolus' },
        desc: '50 mcg/hr for 2–5 days after 50 mcg bolus'
      },
      peds: null,
      note: 'Splanchnic vasoconstrictor for suspected variceal hemorrhage; give with antibiotic prophylaxis (e.g., ceftriaxone) in cirrhosis.',
      warnings: ['Hyper-/hypoglycemia, bradycardia.'],
      source: 'AASLD portal hypertension guidance',
      review: 'Bag concentration (500 mcg/100 mL) is an example mix only — varies by pharmacy.'
    },
    {
      id: 'dextrose', name: 'Dextrose — Hypoglycemia', group: 'Anticoag, GI & endocrine',
      conc: 'D50 = 0.5 g/mL; D10 = 0.1 g/mL',
      adult: { type: 'fixed', dose: 25, unit: 'g', perMl: 0.5, conc: 'D50 (0.5 g/mL)', desc: 'IV (50 mL D50); D10 in 100 mL aliquots is a common alternative' },
      peds: { type: 'weight', perKg: [0.5, 1], max: 25, unit: 'g', perMl: 0.1, conc: 'D10 (0.1 g/mL)', desc: 'IV/IO (D10: 5–10 mL/kg)' },
      note: 'Recheck glucose 15 min after treatment. Give thiamine before or with glucose in malnourished/alcohol-use patients.',
      warnings: ['D50 is hyperosmolar — extravasation causes tissue injury; avoid D50 in young children.'],
      source: 'AHA PALS / ADA'
    },
    {
      id: 'glucagon', name: 'Glucagon — Hypoglycemia', group: 'Anticoag, GI & endocrine',
      conc: '1 mg/mL (reconstituted)',
      adult: { type: 'fixed', dose: 1, unit: 'mg', perMl: 1, desc: 'IM/SC/IV when no IV access for dextrose' },
      peds: null,
      note: 'Needs hepatic glycogen — less effective in alcohol use, starvation, adrenal insufficiency.',
      warnings: ['Vomiting is common — position on side.'],
      source: 'Glucagon prescribing information'
    },
    {
      id: 'insulin_hyperk', name: 'Insulin (regular) — Hyperkalemia', group: 'Anticoag, GI & endocrine',
      conc: '100 units/mL',
      adult: { type: 'fixed', dose: 10, unit: 'units', desc: 'IV with dextrose 25 g (if glucose <250 mg/dL)' },
      peds: { type: 'weight', perKg: 0.1, max: 10, unit: 'units', desc: 'IV with dextrose 0.5 g/kg' },
      note: 'Shifts K+ into cells within 15–30 min. Also give calcium if ECG changes; albuterol also shifts K+.',
      warnings: ['Hypoglycemia is common (especially in renal failure) — check glucose hourly for several hours.', 'Draw regular insulin with an insulin syringe; high-alert medication.'],
      source: 'AHA ACLS (special circumstances) / KDIGO',
      review: 'Pediatric 0.1 units/kg (max 10 units) with dextrose 0.5 g/kg — commonly cited but varies between pediatric protocols; some adult protocols use 5 units in renal failure.'
    },

    // ───────────── Neuro ─────────────
    {
      id: 'lorazepam_se', name: 'Lorazepam — Status epilepticus', group: 'Neuro',
      conc: '2 mg/mL (refrigerate)',
      adult: { type: 'weight', perKg: 0.1, max: 4, unit: 'mg', perMl: 2, desc: 'IV, max 4 mg/dose; may repeat once in 5–10 min' },
      peds: { type: 'weight', perKg: 0.1, max: 4, unit: 'mg', perMl: 2, desc: 'IV, max 4 mg/dose; may repeat once in 5–10 min' },
      note: 'First-line benzodiazepine when IV access is available. Underdosing is a common error.',
      warnings: ['Respiratory depression and hypotension — be ready to support ventilation.'],
      source: 'American Epilepsy Society 2016'
    },
    {
      id: 'midazolam_im', name: 'Midazolam IM — Status epilepticus', group: 'Neuro',
      conc: '5 mg/mL',
      adult: { type: 'fixed', dose: 10, unit: 'mg', perMl: 5, desc: 'IM, single dose (>40 kg)' },
      peds: { type: 'tiered', unit: 'mg', desc: 'IM, single dose', tiers: [{ minKg: 13, maxKg: 40, dose: 5 }, { overKg: 40, dose: 10 }] },
      note: 'First-line when no IV access (RAMPART). Intranasal and buccal routes are alternatives.',
      warnings: ['No dose listed below 13 kg in this reference — use your pediatric protocol.'],
      source: 'American Epilepsy Society 2016 / RAMPART'
    },
    {
      id: 'levetiracetam', name: 'Levetiracetam — Status epilepticus', group: 'Neuro',
      conc: '500 mg/5 mL (100 mg/mL) — dilute',
      adult: { type: 'weight', perKg: 60, max: 4500, unit: 'mg', desc: 'IV over ~10–15 min' },
      peds: { type: 'weight', perKg: 60, max: 4500, unit: 'mg', desc: 'IV over ~10–15 min' },
      note: 'Second-line after benzodiazepines. Equally effective as fosphenytoin and valproate in ESETT.',
      warnings: ['Adjust maintenance dosing for renal impairment.'],
      source: 'ESETT / American Epilepsy Society'
    },
    {
      id: 'fosphenytoin', name: 'Fosphenytoin — Status epilepticus', group: 'Neuro',
      conc: '50 mg PE/mL',
      adult: { type: 'weight', perKg: 20, max: 1500, unit: 'mg PE', perMl: 50, desc: 'IV, max rate 150 mg PE/min' },
      peds: { type: 'weight', perKg: 20, max: 1500, unit: 'mg PE', perMl: 50, desc: 'IV, max rate 3 mg PE/kg/min (max 150 mg PE/min)' },
      note: 'Dosed in phenytoin equivalents (PE). Second-line after benzodiazepines.',
      warnings: ['Continuous cardiac and BP monitoring during infusion — hypotension and arrhythmias.', 'Dosing errors from confusing mg PE with mg of fosphenytoin have caused deaths.'],
      source: 'ESETT / Fosphenytoin prescribing information'
    },
    {
      id: 'valproate', name: 'Valproate — Status epilepticus', group: 'Neuro',
      conc: '100 mg/mL — dilute',
      adult: { type: 'weight', perKg: 40, max: 3000, unit: 'mg', desc: 'IV over ~10 min' },
      peds: { type: 'weight', perKg: 40, max: 3000, unit: 'mg', desc: 'IV over ~10 min' },
      note: 'Second-line option after benzodiazepines.',
      warnings: ['Avoid in pregnancy, liver disease, known mitochondrial disorders, and children <2 years.'],
      source: 'ESETT / American Epilepsy Society'
    },
    {
      id: 'alteplase_stroke', name: 'Alteplase — Acute ischemic stroke', group: 'Neuro',
      conc: '1 mg/mL (reconstituted)',
      adult: {
        type: 'weight', perKg: 0.9, max: 90, unit: 'mg', perMl: 1, desc: 'Total dose (max 90 mg)',
        extras: [{ label: 'Bolus — 10% over 1 min', perKg: 0.09, max: 9 }, { label: 'Infusion — 90% over 60 min', perKg: 0.81, max: 81 }]
      },
      peds: null,
      note: 'Within 4.5 hr of last known well after CT excludes hemorrhage. Keep BP ≤185/110 before and ≤180/105 for 24 hr after.',
      warnings: ['Waste excess drug from the vial BEFORE starting so the pump cannot overdose.', 'Different dosing from STEMI/PE alteplase — never interchange.', 'Neuro checks and BP per protocol; stop infusion for neuro decline, angioedema, or bleeding.'],
      source: 'AHA/ASA acute ischemic stroke guideline'
    },
    {
      id: 'tenecteplase_stroke', name: 'Tenecteplase — Acute ischemic stroke', group: 'Neuro',
      conc: '5 mg/mL (reconstituted)',
      adult: { type: 'weight', perKg: 0.25, max: 25, unit: 'mg', perMl: 5, desc: 'Single IV bolus over 5 sec (max 25 mg)' },
      peds: null,
      note: 'Single-bolus alternative to alteplase within 4.5 hr of last known well.',
      warnings: ['STEMI tenecteplase dosing is DIFFERENT (weight-tiered, up to 50 mg) — do not confuse.', 'Same bleeding precautions and BP targets as alteplase.'],
      source: 'AHA/ASA stroke guideline / tenecteplase prescribing information'
    },
    {
      id: 'mannitol', name: 'Mannitol 20% — Elevated ICP', group: 'Neuro',
      conc: '20% (0.2 g/mL)',
      adult: { type: 'weight', perKg: [0.25, 1], unit: 'g', perMl: 0.2, desc: 'IV bolus over ~15–20 min' },
      peds: { type: 'weight', perKg: [0.25, 1], unit: 'g', perMl: 0.2, desc: 'IV bolus over ~15–20 min' },
      note: 'Osmotic therapy for suspected herniation / raised ICP. Hypertonic saline is an alternative.',
      warnings: ['Use an in-line filter (crystals). Osmotic diuresis — place Foley and avoid in hypotension/hypovolemia.'],
      source: 'Brain Trauma Foundation'
    },

    // ───────────── Respiratory & allergy ─────────────
    {
      id: 'epi_anaphylaxis', name: 'Epinephrine — Anaphylaxis (IM)', group: 'Respiratory & allergy',
      conc: '1 mg/mL (formerly labeled 1:1,000)',
      adult: { type: 'fixed', dose: 0.5, unit: 'mg', perMl: 1, desc: 'IM anterolateral thigh, may repeat q5–15 min' },
      peds: { type: 'weight', perKg: 0.01, max: 0.3, unit: 'mg', perMl: 1, desc: 'IM anterolateral thigh, may repeat q5–15 min (max 0.3 mg prepubertal; 0.5 mg adolescents)' },
      note: 'IM into the vastus lateralis — never IV push of 1 mg/mL. Antihistamines and steroids are adjuncts only.',
      warnings: ['This is 10× the concentration used in cardiac arrest — double-check before drawing up.'],
      source: 'World Allergy Organization / AAAAI'
    },
    {
      id: 'albuterol', name: 'Albuterol — Nebulized', group: 'Respiratory & allergy',
      conc: '2.5 mg/3 mL (0.083%)',
      adult: { type: 'fixed', dose: [2.5, 5], unit: 'mg', desc: 'Nebulized q20 min × 3, then as needed' },
      peds: { type: 'weight', perKg: 0.15, min: 2.5, max: 5, unit: 'mg', desc: 'Nebulized q20 min × 3 (min 2.5 mg)' },
      note: 'Also used to shift potassium into cells in hyperkalemia (higher doses).',
      warnings: ['Tachycardia, tremor, hypokalemia.'],
      source: 'NAEPP EPR-3'
    },
    {
      id: 'magnesium_asthma', name: 'Magnesium Sulfate — Severe asthma', group: 'Respiratory & allergy',
      conc: 'Premix, e.g. 2 g/50 mL',
      adult: { type: 'fixed', dose: 2, unit: 'g', desc: 'IV over 20 min' },
      peds: { type: 'weight', perKg: [25, 75], max: 2000, unit: 'mg', desc: 'IV over 20 min' },
      note: 'For severe exacerbations not responding to initial bronchodilators.',
      warnings: ['Hypotension and flushing with rapid infusion.'],
      source: 'NAEPP EPR-3'
    },
    {
      id: 'dexamethasone_croup', name: 'Dexamethasone — Croup', group: 'Respiratory & allergy',
      conc: 'PO solution or 4 mg/mL / 10 mg/mL injection — verify',
      adult: null,
      peds: { type: 'weight', perKg: 0.6, max: 16, unit: 'mg', desc: 'PO/IM/IV single dose' },
      note: 'Lower doses (0.15–0.3 mg/kg) are also effective for mild croup in several studies.',
      warnings: [],
      source: 'Cochrane review / common pediatric ED protocols',
      review: 'Maximum dose varies between references (10 mg vs 16 mg).'
    },
    {
      id: 'racemic_epi', name: 'Racemic Epinephrine 2.25% — Croup', group: 'Respiratory & allergy',
      conc: '2.25% solution',
      adult: null,
      peds: { type: 'fixed', dose: 0.5, unit: 'mL', desc: 'of 2.25% in 3 mL NS, nebulized' },
      note: 'For moderate–severe croup with stridor at rest. Give with dexamethasone.',
      warnings: ['Observe for rebound symptoms (commonly 2–4 hr) before discharge.'],
      source: 'Common pediatric ED protocols'
    },
    {
      id: 'diphenhydramine', name: 'Diphenhydramine', group: 'Respiratory & allergy',
      conc: '50 mg/mL',
      adult: { type: 'fixed', dose: [25, 50], unit: 'mg', perMl: 50, desc: 'IV/IM/PO' },
      peds: { type: 'weight', perKg: 1, max: 50, unit: 'mg', perMl: 50, desc: 'IV/IM/PO' },
      note: 'Adjunct for urticaria/itch in allergic reactions — does not treat airway or hemodynamic compromise.',
      warnings: ['Sedation; paradoxical excitation in young children.'],
      source: 'Prescribing information'
    },
    {
      id: 'ondansetron', name: 'Ondansetron', group: 'Respiratory & allergy',
      conc: '2 mg/mL',
      adult: { type: 'fixed', dose: 4, unit: 'mg', perMl: 2, desc: 'IV/IM/ODT' },
      peds: { type: 'weight', perKg: 0.15, max: 4, unit: 'mg', perMl: 2, desc: 'IV (≥1 month old)' },
      note: 'Antiemetic.',
      warnings: ['QT prolongation — caution with other QT-prolonging drugs and electrolyte abnormalities.'],
      source: 'Ondansetron prescribing information'
    },

    // ───────────── Reversal agents & toxicology ─────────────
    {
      id: 'naloxone', name: 'Naloxone — Opioid overdose', group: 'Reversal & toxicology',
      conc: '0.4 mg/mL (IV/IM) or 4 mg/spray (IN)',
      adult: { type: 'fixed', dose: 0.4, unit: 'mg', perMl: 0.4, desc: 'IV/IM, titrate to respirations, may repeat q2–3 min (IN: 4 mg)' },
      peds: { type: 'weight', perKg: 0.1, max: 2, unit: 'mg', perMl: 0.4, desc: 'IV/IO/IM for full reversal (max 2 mg)' },
      note: 'Titrate to adequate breathing, not full consciousness, in opioid-dependent patients. Duration may be shorter than the opioid — observe for re-sedation.',
      warnings: ['Over-reversal can precipitate acute withdrawal, vomiting, and combativeness.'],
      source: 'AHA / PALS'
    },
    {
      id: 'flumazenil', name: 'Flumazenil — Benzodiazepine reversal', group: 'Reversal & toxicology',
      conc: '0.1 mg/mL',
      adult: { type: 'fixed', dose: 0.2, unit: 'mg', perMl: 0.1, desc: 'IV over 30 sec; may repeat q1 min (sedation reversal max 1 mg total)' },
      peds: { type: 'weight', perKg: 0.01, max: 0.2, unit: 'mg', perMl: 0.1, desc: 'IV over 15 sec; may repeat q1 min (max cumulative 0.05 mg/kg or 1 mg)' },
      note: 'Mainly for reversing iatrogenic procedural sedation. Generally avoided in undifferentiated overdose.',
      warnings: ['Can precipitate refractory seizures in chronic benzodiazepine users and in TCA/mixed overdoses.', 'Re-sedation can occur — observe.'],
      source: 'Flumazenil prescribing information'
    },
    {
      id: 'kcentra_2_4', name: '4F-PCC (Kcentra) — Warfarin, INR 2 to <4', group: 'Reversal & toxicology',
      conc: 'Units of Factor IX — potency varies by lot',
      adult: { type: 'weight', perKg: 25, max: 2500, unit: 'units', desc: 'IV (max 2,500 units); give with vitamin K 10 mg IV' },
      peds: null,
      note: 'Urgent warfarin reversal for major bleeding or emergency surgery. Dose uses actual lot potency.',
      warnings: ['Thromboembolic risk. Weight-based dosing is capped at 100 kg.'],
      source: 'Kcentra prescribing information'
    },
    {
      id: 'kcentra_4_6', name: '4F-PCC (Kcentra) — Warfarin, INR 4–6', group: 'Reversal & toxicology',
      conc: 'Units of Factor IX — potency varies by lot',
      adult: { type: 'weight', perKg: 35, max: 3500, unit: 'units', desc: 'IV (max 3,500 units); give with vitamin K 10 mg IV' },
      peds: null,
      note: 'Urgent warfarin reversal for major bleeding or emergency surgery.',
      warnings: ['Thromboembolic risk. Weight-based dosing is capped at 100 kg.'],
      source: 'Kcentra prescribing information'
    },
    {
      id: 'kcentra_6', name: '4F-PCC (Kcentra) — Warfarin, INR >6', group: 'Reversal & toxicology',
      conc: 'Units of Factor IX — potency varies by lot',
      adult: { type: 'weight', perKg: 50, max: 5000, unit: 'units', desc: 'IV (max 5,000 units); give with vitamin K 10 mg IV' },
      peds: null,
      note: 'Urgent warfarin reversal for major bleeding or emergency surgery.',
      warnings: ['Thromboembolic risk. Weight-based dosing is capped at 100 kg.'],
      source: 'Kcentra prescribing information'
    },
    {
      id: 'vitamin_k', name: 'Vitamin K (phytonadione) — Warfarin reversal', group: 'Reversal & toxicology',
      conc: '10 mg/mL',
      adult: { type: 'fixed', dose: 10, unit: 'mg', perMl: 10, desc: 'Slow IV infusion (diluted) for major bleeding, with PCC' },
      peds: null,
      note: 'Onset takes hours — PCC provides the immediate reversal; vitamin K sustains it.',
      warnings: ['IV administration can cause anaphylactoid reactions — dilute and infuse slowly (≤1 mg/min).'],
      source: 'Phytonadione prescribing information / ACC expert consensus'
    },
    {
      id: 'idarucizumab', name: 'Idarucizumab (Praxbind) — Dabigatran reversal', group: 'Reversal & toxicology',
      conc: '2.5 g/50 mL vials',
      adult: { type: 'fixed', dose: 5, unit: 'g', desc: 'IV (two 2.5 g vials) as consecutive infusions or bolus injections' },
      peds: null,
      note: 'Specific reversal agent for dabigatran only.',
      warnings: ['Thromboembolic risk once anticoagulation is reversed — restart when safe.'],
      source: 'Praxbind prescribing information'
    },
    {
      id: 'protamine', name: 'Protamine — Heparin reversal', group: 'Reversal & toxicology',
      conc: '10 mg/mL',
      adult: { type: 'text', text: '1 mg per 100 units of heparin given in the previous ~2–3 hr; max 50 mg', desc: 'Slow IV, no faster than 5 mg/min' },
      peds: null,
      note: 'Only partially reverses low-molecular-weight heparin.',
      warnings: ['Hypotension, bradycardia, anaphylaxis (higher risk with fish allergy, prior protamine, NPH insulin, vasectomy).'],
      source: 'Protamine prescribing information'
    },
    {
      id: 'txa', name: 'Tranexamic Acid (TXA) — Trauma hemorrhage', group: 'Reversal & toxicology',
      conc: '100 mg/mL',
      adult: { type: 'fixed', dose: 1, unit: 'g', desc: 'IV over 10 min, then 1 g over 8 hr' },
      peds: { type: 'weight', perKg: 15, max: 1000, unit: 'mg', perMl: 100, desc: 'IV over 10 min, then 2 mg/kg/hr for 8 hr' },
      note: 'Give within 3 hr of injury (benefit falls, and harm may increase, after 3 hr).',
      warnings: ['Rapid IV push can cause hypotension. Seizure risk at high doses.'],
      source: 'CRASH-2 / pediatric trauma consensus',
      review: 'Pediatric 15 mg/kg (max 1 g) then 2 mg/kg/hr — from pediatric trauma consensus (e.g., RCPCH/PED-TRAX); regimens vary.'
    },
    {
      id: 'acetylcysteine', name: 'Acetylcysteine (IV) — Acetaminophen', group: 'Reversal & toxicology',
      conc: '200 mg/mL (20%) — dilute',
      adult: {
        type: 'weight', perKg: 150, max: 15000, unit: 'mg', desc: 'Bag 1 (loading) over 60 min — weight capped at 100 kg',
        extras: [{ label: 'Bag 2 — over 4 hr (50 mg/kg)', perKg: 50, max: 5000 }, { label: 'Bag 3 — over 16 hr (100 mg/kg)', perKg: 100, max: 10000 }]
      },
      peds: {
        type: 'weight', perKg: 150, max: 15000, unit: 'mg', desc: 'Bag 1 (loading) over 60 min — use pediatric dilution volumes',
        extras: [{ label: 'Bag 2 — over 4 hr (50 mg/kg)', perKg: 50, max: 5000 }, { label: 'Bag 3 — over 16 hr (100 mg/kg)', perKg: 100, max: 10000 }]
      },
      note: 'Classic 21-hour, 3-bag regimen. Some centers now use a 2-bag regimen — follow your protocol and poison center.',
      warnings: ['Anaphylactoid reactions (flushing, bronchospasm), mostly during the loading bag — slow/pause and treat.', 'Children: reduce diluent volume to avoid fluid overload/hyponatremia.'],
      source: 'Acetadote prescribing information'
    },
    {
      id: 'hydroxocobalamin', name: 'Hydroxocobalamin (Cyanokit) — Cyanide', group: 'Reversal & toxicology',
      conc: '5 g vial reconstituted in 200 mL (25 mg/mL)',
      adult: { type: 'fixed', dose: 5, unit: 'g', desc: 'IV over 15 min; may repeat 5 g' },
      peds: { type: 'weight', perKg: 70, max: 5000, unit: 'mg', perMl: 25, desc: 'IV over 15 min' },
      note: 'Suspect cyanide in smoke-inhalation victims with altered mental status and high lactate.',
      warnings: ['Turns skin and urine red and interferes with colorimetric lab tests — draw labs first if possible.'],
      source: 'Cyanokit prescribing information'
    },
    {
      id: 'fomepizole', name: 'Fomepizole — Toxic alcohols', group: 'Reversal & toxicology',
      conc: '1 g/mL — dilute',
      adult: { type: 'weight', perKg: 15, unit: 'mg', desc: 'IV loading dose over 30 min; then 10 mg/kg q12h × 4 doses' },
      peds: { type: 'weight', perKg: 15, unit: 'mg', desc: 'IV loading dose over 30 min; then 10 mg/kg q12h × 4 doses' },
      note: 'Blocks alcohol dehydrogenase in methanol/ethylene glycol poisoning. Dose more frequently during dialysis.',
      warnings: ['Solidifies below 25 °C — warm vial to liquefy before drawing up.'],
      source: 'Fomepizole prescribing information'
    },
    {
      id: 'lipid_emulsion', name: 'Lipid Emulsion 20% — LAST', group: 'Reversal & toxicology',
      conc: '20% lipid emulsion',
      adult: { type: 'weight', perKg: 1.5, max: 100, unit: 'mL', desc: 'IV bolus over 2–3 min (100 mL if >70 kg); then infusion 0.25 mL/kg/min' },
      peds: { type: 'weight', perKg: 1.5, max: 100, unit: 'mL', desc: 'IV bolus over 2–3 min; then infusion 0.25 mL/kg/min' },
      note: 'For local anesthetic systemic toxicity. Continue CPR; use small epinephrine doses (≤1 mcg/kg).',
      warnings: ['Upper limit ~12 mL/kg total lipid.', 'Avoid vasopressin, calcium-channel blockers, beta-blockers, and local anesthetics in LAST.'],
      source: 'ASRA LAST checklist'
    },
    {
      id: 'bicarb_tca', name: 'Sodium Bicarbonate — TCA toxicity (QRS >100 ms)', group: 'Reversal & toxicology',
      conc: '1 mEq/mL (8.4%)',
      adult: { type: 'weight', perKg: [1, 2], unit: 'mEq', perMl: 1, desc: 'IV bolus, repeat until QRS narrows; target pH 7.45–7.55' },
      peds: { type: 'weight', perKg: [1, 2], unit: 'mEq', perMl: 1, desc: 'IV bolus (4.2% in infants)' },
      note: 'Sodium load and alkalinization overcome sodium-channel blockade.',
      warnings: ['Monitor K+ (alkalosis drives hypokalemia) and sodium.'],
      source: 'Goldfrank\'s Toxicologic Emergencies'
    },
    {
      id: 'atropine_op', name: 'Atropine — Organophosphate poisoning', group: 'Reversal & toxicology',
      conc: '0.1 mg/mL or 0.4–1 mg/mL vials',
      adult: { type: 'fixed', dose: [1, 2], unit: 'mg', desc: 'IV; double the dose every 5 min until secretions dry (bronchorrhea resolves)' },
      peds: null,
      note: 'Endpoint is drying of respiratory secretions — NOT heart rate or pupil size. Very large cumulative doses may be needed. Give pralidoxime too.',
      warnings: ['Tachycardia is not a reason to stop atropine when bronchorrhea persists.'],
      source: 'Goldfrank\'s Toxicologic Emergencies / WHO'
    },

    // ───────────── Resuscitation fluids ─────────────
    {
      id: 'crystalloid', name: 'Crystalloid bolus (NS / LR)', group: 'Fluids',
      conc: 'Isotonic crystalloid',
      adult: { type: 'weight', perKg: 30, unit: 'mL', desc: 'Sepsis-induced hypoperfusion: within first 3 hr; reassess frequently' },
      peds: { type: 'weight', perKg: [10, 20], unit: 'mL', desc: 'Over 5–20 min; reassess after each bolus' },
      note: 'Stop and reassess for fluid overload (crackles, hepatomegaly, rising work of breathing) between boluses.',
      warnings: ['Use smaller volumes (e.g., 5–10 mL/kg) and caution in heart failure, renal failure, and pediatric cardiac disease/DKA.'],
      source: 'Surviving Sepsis Campaign / AHA PALS'
    }
  ];

  var api = { DRUGS: DRUGS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PulseDrugs = api;
})(typeof window !== 'undefined' ? window : this);
