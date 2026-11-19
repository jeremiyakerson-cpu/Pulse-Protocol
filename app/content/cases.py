"""Case bank. Every patient here is fictional or composite.

Schema
------
id, section, kind ("urgent" = simple urgent-care, "deterioration" = complex),
title, patient (age/sex line), vignette, vitals (dict), stages[], related[] (index ids),
flags[] (guideline changes / version conflicts to surface).

Each stage: label, prompt, update (optional new findings shown when the stage opens),
options[] of {t, ok, why}, takeaway. Exactly one option is correct and every option
has a `why`, including the right one. `dose_check` ties a stage to the dosing table so the
validator can confirm the answer key matches the vetted entry.
"""

def opt(t, why, ok=False):
    return dict(t=t, ok=ok, why=why)

def right(t, why):
    return opt(t, why, ok=True)

CASES = [
  dict(
    id="ankle-inversion", section="Musculoskeletal and wound", kind="urgent",
    title="Rolled ankle on the court", patient="22-year-old man",
    vignette="He rolled his right ankle inward during a pickup basketball game an hour ago. He walked in with a limp. "
             "The lateral ankle is swollen and tender just in front of the lateral malleolus. There is no tenderness "
             "along the back edge or tip of either malleolus, the base of the fifth metatarsal or the navicular. "
             "He took four steps in triage without help.",
    vitals=dict(HR=84, BP="128/76", RR=16, SpO2=99, Temp=36.8, Pain="6/10"),
    stages=[
      dict(label="Imaging", prompt="Using the Ottawa ankle rules, does he need an ankle X-ray?",
        options=[
          opt("Yes. Any ankle with visible swelling needs a film.",
              "Swelling is not one of the criteria. The rules look only at bone tenderness at specific sites and the ability to bear weight."),
          right("No. He has no tenderness at the defined bony sites and could take four steps.",
              "Correct. With no point tenderness at the posterior edge or tip of either malleolus and the ability to bear weight for four steps, the rules say an X-ray is not needed."),
          opt("Yes, because an inversion mechanism is high risk.",
              "Mechanism is not part of the rules. Inversion is the most common mechanism for simple sprains."),
          opt("Only if his pain score is 7 or higher.",
              "Pain intensity is not a criterion. A high pain score with no bony tenderness still does not meet the rules."),
        ],
        takeaway="Ottawa ankle rules: X-ray if there is malleolar-zone pain plus bone tenderness at the posterior edge or tip of either malleolus, or inability to bear weight four steps both at injury and in the ED."),
      dict(label="First care", prompt="What is the best initial nursing care?",
        options=[
          right("Ice, elevation and compression, then document distal pulses, sensation and capillary refill.",
              "Correct. Cold and elevation limit swelling, and a neurovascular check gives a baseline before any wrap or splint."),
          opt("Apply heat to loosen the joint.",
              "Heat in the first 48 hours increases blood flow and swelling."),
          opt("Apply a circumferential cast.",
              "A rigid circumferential cast on a fresh, swelling injury risks compartment pressure, and a sprain does not need one."),
          opt("Tell him not to bear weight at all for six weeks.",
              "Early protected weight bearing as tolerated speeds recovery from lateral sprains. Prolonged immobilization does not."),
        ],
        takeaway="Recheck the neurovascular status after any wrap or splint is applied."),
    ],
    related=["ottawa-ankle", "neurovascular-check"], flags=[],
  ),

  dict(
    id="febrile-toddler", section="Pediatrics", kind="urgent",
    title="Febrile toddler with ear pain", patient="3-year-old girl, 15 kg",
    vignette="Her father says she has had a fever since last night and keeps pulling at her right ear. She is playful in "
             "the waiting room, drinking juice and has had two wet diapers today. Immunizations are up to date. "
             "No medication has been given yet.",
    vitals=dict(HR=132, BP="98/60", RR=26, SpO2=99, Temp=39.2, Weight="15 kg"),
    stages=[
      dict(label="Antipyretic", prompt="The provider orders acetaminophen PO by weight. Which dose is right for 15 kg?",
        dose_check=dict(entry="acetaminophen", weight=15),
        options=[
          opt("150 mg", "That is 10 mg/kg, below the reference dose of 15 mg/kg."),
          right("225 mg", "Correct. 15 mg/kg × 15 kg = 225 mg, under the 1000 mg single-dose cap. At 160 mg/5 mL that is about 7 mL."),
          opt("450 mg", "That is 30 mg/kg, double the reference dose. Repeated doubling is a common cause of pediatric liver injury."),
          opt("Aspirin 81 mg", "Aspirin is avoided in children with viral-type illness because of the risk of Reye syndrome."),
        ],
        takeaway="Calculate from the reference table, then check the concentration on the bottle before converting to mL."),
      dict(label="Teaching", prompt="Which discharge teaching point is most important?",
        options=[
          right("Measure with the oral syringe that comes with the medicine and dose by weight, not age.",
              "Correct. Kitchen spoons and age-based dosing are the most common sources of home dosing errors."),
          opt("Wake her every two hours overnight to give fever medicine.",
              "Treating the number is not the goal. Antipyretics are for comfort, and sleep is fine if she is comfortable."),
          opt("Alternate acetaminophen and ibuprofen every two hours.",
              "Alternating schedules increase the risk of dosing errors and are not routinely recommended."),
          opt("Return only if the fever goes above 40 °C.",
              "Return precautions are about how she looks and acts: hard breathing, fewer wet diapers, hard to wake, a rash that does not blanch. A single temperature cutoff is not enough."),
        ],
        takeaway="Ask about every product given at home. Combination cold medicines often contain acetaminophen."),
    ],
    related=["pediatric-fever", "weight-based-safety"], flags=[],
  ),

  dict(
    id="asthma-teen", section="Respiratory", kind="urgent",
    title="Wheezing after soccer practice", patient="16-year-old girl",
    vignette="Known asthma. She ran out of her rescue inhaler last week. She is speaking in full sentences, sitting "
             "upright, with expiratory wheeze in all fields and mild intercostal retractions.",
    vitals=dict(HR=108, BP="118/72", RR=24, SpO2=95, Temp=37.0),
    stages=[
      dict(label="First treatment", prompt="What is the first-line treatment to anticipate?",
        options=[
          right("Inhaled short-acting beta-agonist (albuterol) by MDI with spacer or nebulizer, with early systemic steroid.",
              "Correct. A SABA relieves bronchospasm within minutes, and an early steroid reduces relapse and admission."),
          opt("IV magnesium as the first drug.",
              "Magnesium is an add-on for severe exacerbations that do not respond to initial bronchodilators."),
          opt("Oral antibiotic.",
              "Most exacerbations are viral or trigger-driven. Antibiotics do not treat bronchospasm."),
          opt("Sedative to reduce anxiety.",
              "Sedatives suppress respiratory drive and are avoided in an acute asthma attack."),
        ],
        takeaway="Reassess work of breathing, speech and SpO2 after each treatment."),
      dict(label="Reassessment",
        update="Forty minutes later she is quiet and can only say two or three words at a time. The wheeze is much softer. SpO2 89%, RR 34, HR 136.",
        prompt="How do you read the softer wheeze?",
        options=[
          opt("Improving. Less wheezing means the airways are opening.",
              "Less wheeze with worse speech, rising RR and falling SpO2 means less air is moving."),
          right("Ominous. A quiet chest with fatigue suggests too little airflow. Escalate now.",
              "Correct. A silent or near-silent chest is a sign of impending respiratory failure. Call the provider and prepare for continuous bronchodilators, adjuncts and possible airway support."),
          opt("Anxiety. Coach slow breathing and recheck in an hour.",
              "Waiting an hour risks arrest. Objective signs are worsening."),
          opt("Normal post-treatment fatigue. Let her rest.",
              "Fatigue in a child working this hard to breathe is a red flag, not recovery."),
        ],
        takeaway="Watch the trend in speech and mental status as much as the wheeze."),
    ],
    related=["asthma-exacerbation"], flags=[],
  ),

  dict(
    id="shrimp-anaphylaxis", section="Medical emergencies", kind="urgent",
    title="Hives and a hoarse voice after dinner", patient="29-year-old woman",
    vignette="She ate shrimp at a restaurant 20 minutes ago. She has hives on her chest and arms, swollen lips, a hoarse "
             "voice and audible wheeze. She says her throat feels tight.",
    vitals=dict(HR=118, BP="92/58", RR=24, SpO2=93, Temp=36.9),
    stages=[
      dict(label="First drug", prompt="Which medication comes first?",
        options=[
          right("Epinephrine IM in the anterolateral thigh.",
              "Correct. Epinephrine is the only first-line drug. It reverses airway edema, bronchospasm and vasodilation."),
          opt("Diphenhydramine IV.",
              "Antihistamines help the itching and hives but do not treat airway swelling or hypotension. They are adjuncts after epinephrine."),
          opt("Methylprednisolone IV.",
              "Steroids take hours to work and do not treat the acute reaction. Evidence that they prevent biphasic reactions is weak."),
          opt("Nebulized albuterol alone.",
              "Albuterol treats bronchospasm only. It does nothing for laryngeal edema or shock."),
        ],
        takeaway="Delayed epinephrine is the factor most often linked to fatal anaphylaxis."),
      dict(label="Persistent shock",
        update="Five minutes after the first dose: BP 84/50, HR 126, still wheezing.",
        prompt="What is the best next step?",
        options=[
          right("Lay her flat with legs raised (or sitting if breathing is worse lying down), give an isotonic fluid bolus through a large-bore IV and anticipate a repeat IM epinephrine dose.",
              "Correct. Positioning and fluid support preload, and a repeat dose 5 to 15 minutes after the first is standard when symptoms persist."),
          opt("Help her stand and walk to the bathroom.",
              "Sudden upright posture during anaphylactic shock has been linked to cardiovascular collapse."),
          opt("Wait 30 minutes for the antihistamine to work.",
              "Antihistamines do not treat shock. Waiting delays the drug that does."),
          opt("Give a second dose of diphenhydramine.",
              "Repeating an adjunct does not address hypotension or airway swelling."),
        ],
        takeaway="If she does not respond to two IM doses, anticipate an epinephrine infusion per protocol."),
      dict(label="Discharge", prompt="She stabilizes. What is the key teaching before discharge?",
        options=[
          right("Carry two epinephrine auto-injectors, practice using one, and know that symptoms can return hours later.",
              "Correct. Biphasic reactions occur in a minority of patients, and a second dose may be needed before EMS arrives."),
          opt("Oral antihistamines are enough if it happens again.",
              "Antihistamines do not stop progression to airway compromise or shock."),
          opt("A reaction this mild will not get worse next time.",
              "Severity is unpredictable from one exposure to the next."),
          opt("She can avoid shellfish by checking menus for the word 'shrimp'.",
              "Cross-contact and hidden ingredients are common. Avoidance teaching needs more than a single keyword."),
        ],
        takeaway="Refer to an allergist and confirm she can show the auto-injector technique."),
    ],
    related=["anaphylaxis"], flags=[],
  ),

  dict(
    id="urosepsis-elder", section="Medical emergencies", kind="deterioration",
    title="Confused and febrile from assisted living", patient="78-year-old woman, 60 kg",
    vignette="Staff say she has been more confused since yesterday and her urine smells strong. She is oriented to "
             "name only (her baseline is fully oriented). Skin is warm and flushed.",
    vitals=dict(HR=112, BP="96/60", RR=24, SpO2=94, Temp=38.9, Weight="60 kg"),
    stages=[
      dict(label="First hour", prompt="Sepsis is suspected. Which sequence matches the first-hour bundle?",
        options=[
          right("Lactate and blood cultures, broad-spectrum antibiotics, and 30 mL/kg crystalloid if hypotensive or lactate is 4 or higher.",
              "Correct. Cultures before antibiotics when that causes no meaningful delay, antibiotics within the hour, and fluids for hypoperfusion."),
          opt("Wait for the urinalysis before giving antibiotics.",
              "Each hour of delay in antibiotics for septic shock is associated with higher mortality. Do not wait for a source to be confirmed."),
          opt("Give antibiotics first and skip cultures to save time.",
              "Cultures should be drawn first when it does not delay antibiotics. They guide later de-escalation."),
          opt("Hold IV fluids because of her age.",
              "Age alone is not a reason to withhold fluids. Give the bolus and reassess for overload as you go."),
        ],
        takeaway="Sepsis-3 qSOFA flags risk but is not recommended as a stand-alone screening tool. Use your facility's screen."),
      dict(label="Deterioration",
        update="After 1.8 L of crystalloid: BP 82/44 (MAP 57), HR 124, lactate 4.6 mmol/L, lungs clear, more drowsy.",
        prompt="What do you anticipate next?",
        options=[
          right("Norepinephrine to target a MAP of 65 or higher, started peripherally if no central line yet.",
              "Correct. Norepinephrine is the first-line vasopressor, and current guidance suggests starting it peripherally rather than delaying for a central line."),
          opt("Another 30 mL/kg bolus without reassessing.",
              "Further fluid should be guided by dynamic reassessment. Persistent hypotension after the initial bolus calls for a vasopressor."),
          opt("Dopamine as the first vasopressor.",
              "Norepinephrine is preferred. Dopamine causes more arrhythmias."),
          opt("Wait for a central line before starting any vasopressor.",
              "Delaying vasopressors prolongs hypoperfusion. A large, proximal peripheral IV is acceptable short term."),
        ],
        takeaway="Septic shock: vasopressor needed to keep MAP at 65 or above, and lactate above 2 despite adequate fluids."),
      dict(label="Monitoring", prompt="Norepinephrine is running through a peripheral IV. What is the priority nursing check?",
        options=[
          right("Inspect the IV site often for blanching, swelling or coolness, and know where the extravasation protocol and antidote are.",
              "Correct. Extravasation can cause tissue necrosis. Early detection and treatment per protocol limits injury."),
          opt("Check the site once per shift.",
              "Peripheral vasopressors need frequent site checks per policy, often hourly or more."),
          opt("Titrate to a systolic of 140 for a safety margin.",
              "Overshooting the MAP target increases vasoconstriction and arrhythmia risk without benefit."),
          opt("Stop monitoring urine output since she is on a vasopressor.",
              "Urine output (about 0.5 mL/kg/h or more) is a key marker of perfusion. Keep tracking it."),
        ],
        takeaway="Trend lactate, mental status, urine output and capillary refill alongside MAP."),
    ],
    related=["sepsis", "vasopressor-safety", "sepsis-screening-card"],
    flags=["Surviving Sepsis Campaign 2021 recommends against qSOFA alone as a screening tool, compared with SIRS, NEWS or MEWS. Older material may still teach qSOFA as the screen."],
  ),

  dict(
    id="inferior-stemi-rv", section="Cardiovascular", kind="deterioration",
    title="Chest pressure and a slow pulse", patient="61-year-old man",
    vignette="Crushing chest pressure for 40 minutes, sweating and nauseated. History of hypertension and smoking.",
    vitals=dict(HR=54, BP="98/62", RR=20, SpO2=95, Temp=36.7),
    stages=[
      dict(label="Door to ECG", prompt="What is the goal time for the first 12-lead ECG?",
        options=[
          right("Within 10 minutes of arrival.",
              "Correct. Early ECG starts the STEMI clock and the door-to-balloon target."),
          opt("Within 30 minutes, after labs are drawn.",
              "Labs should not delay the ECG. Troponin takes time; ST changes do not."),
          opt("After the provider examines him.",
              "Nurses can and should obtain the ECG on arrival for chest pain."),
          opt("Within an hour if pain persists.",
              "Every minute of delay loses heart muscle."),
        ],
        takeaway="Door-to-balloon goal for primary PCI: 90 minutes or less."),
      dict(label="Nitrate order",
        update="ECG: ST elevation in II, III and aVF. Right-sided leads show ST elevation in V4R. Provider orders nitroglycerin 0.4 mg SL.",
        prompt="What do you do?",
        options=[
          right("Hold the nitroglycerin and clarify the order, because of probable right ventricular infarction.",
              "Correct. An infarcted right ventricle depends on preload. Nitrates drop preload and can cause severe hypotension."),
          opt("Give the nitroglycerin as ordered. It relieves ischemic pain.",
              "Nitrates are relatively contraindicated in RV infarction and with SBP under 90 or marked bradycardia."),
          opt("Give morphine instead.",
              "Morphine also lowers preload and can mask ongoing ischemia. It is not a safe substitute here."),
          opt("Give furosemide to unload the heart.",
              "Diuresis worsens the preload problem in RV infarction."),
        ],
        takeaway="Inferior STEMI: get right-sided leads before giving nitrates."),
      dict(label="Hypotension",
        update="BP falls to 84/50. Lungs are clear. HR 50.",
        prompt="What do you anticipate?",
        options=[
          right("An IV fluid bolus to support preload, and ongoing preparation for the cath lab.",
              "Correct. With clear lungs, volume supports RV output while reperfusion is arranged."),
          opt("Fluid restriction to protect the lungs.",
              "Clear lungs and RV involvement favor careful volume loading, not restriction."),
          opt("A beta-blocker to slow the heart further.",
              "He is bradycardic and hypotensive. A beta-blocker could cause collapse."),
          opt("Cancel the cath lab until BP improves.",
              "Reperfusion is the definitive treatment and should not be delayed."),
        ],
        takeaway="Watch for heart block with inferior MI, and have pacing available."),
    ],
    related=["acs-stemi", "ecg-leads"], flags=[],
  ),

  dict(
    id="dka-young-adult", section="Medical emergencies", kind="deterioration",
    title="Vomiting and deep breathing", patient="19-year-old woman, type 1 diabetes",
    vignette="Two days of vomiting and abdominal pain. She ran out of insulin. Breathing is deep and fast with a fruity "
             "odor. Labs: glucose 486 mg/dL, pH 7.12, bicarbonate 9 mEq/L, anion gap 26, potassium 3.1 mEq/L.",
    vitals=dict(HR=124, BP="104/66", RR=30, SpO2=99, Temp=37.2),
    stages=[
      dict(label="Before insulin", prompt="Fluids are running. An insulin infusion is ordered. What do you do first?",
        options=[
          right("Replace potassium and hold insulin until potassium is at least 3.3 mEq/L.",
              "Correct. Insulin drives potassium into cells. Starting it at 3.1 can cause dangerous hypokalemia and arrhythmia."),
          opt("Start the insulin infusion now. Glucose is the emergency.",
              "Glucose is not the immediate threat. Hypokalemia from insulin is."),
          opt("Give sodium bicarbonate for the low pH.",
              "Bicarbonate is reserved for severe acidosis (pH below about 7.0) and can worsen hypokalemia."),
          opt("Give a large insulin bolus to close the gap quickly.",
              "Rapid correction increases the risk of hypokalemia and, in younger patients, cerebral edema."),
        ],
        takeaway="Check potassium before insulin and recheck it every 1 to 2 hours."),
      dict(label="Glucose falling",
        update="Five hours later: glucose 238 mg/dL, anion gap 18, potassium 4.0.",
        prompt="What change do you anticipate?",
        options=[
          right("Add dextrose to the IV fluids and continue insulin until the gap closes.",
              "Correct. Insulin is what clears ketones. Dextrose lets it keep running without hypoglycemia."),
          opt("Stop insulin because glucose is near normal.",
              "Stopping insulin while the gap is open lets ketoacidosis return."),
          opt("Increase insulin to bring glucose to 100.",
              "The target is closing the gap, not normal glucose. Faster drops risk hypoglycemia."),
          opt("Switch to oral fluids and discharge.",
              "She is still acidotic. Resolution criteria are not met."),
        ],
        takeaway="Treat the gap, not the glucose."),
      dict(label="Transition", prompt="The gap has closed and she is eating. How is the drip stopped?",
        options=[
          right("Give subcutaneous basal insulin 1 to 2 hours before stopping the infusion.",
              "Correct. The overlap prevents rebound ketosis, since IV insulin wears off within minutes."),
          opt("Stop the drip, then give subcutaneous insulin at the next meal.",
              "The gap in coverage can restart ketosis."),
          opt("Stop the drip and recheck glucose in the morning.",
              "No insulin coverage risks rapid recurrence."),
          opt("Keep the drip running until discharge.",
              "Once criteria are met and she is eating, she should transition to subcutaneous insulin."),
        ],
        takeaway="Teach sick-day rules and how to get insulin when supply runs out."),
    ],
    related=["dka", "potassium"],
    flags=["DKA thresholds were revised in the 2024 ADA/EASD/JBDS/AACE/DTS consensus. Check that older materials do not conflict with it."],
  ),

  dict(
    id="anticoag-head-injury", section="Neurological", kind="deterioration",
    title="Fell off a ladder, on a blood thinner", patient="45-year-old man",
    vignette="He fell about two meters from a ladder and hit his head. He had a brief loss of consciousness. He now "
             "answers questions appropriately and moves all limbs. He takes apixaban for atrial fibrillation.",
    vitals=dict(HR=78, BP="142/84", RR=16, SpO2=98, Temp=36.6),
    stages=[
      dict(label="Risk", prompt="He looks well. What is the priority?",
        options=[
          right("Expedite a head CT. Anticoagulant use is a high-risk feature even when he looks well.",
              "Correct. Anticoagulated patients can bleed with few early signs, and delayed hemorrhage is a known risk."),
          opt("Discharge with a head-injury sheet if neuro checks stay normal for an hour.",
              "Anticoagulation changes the risk. A normal early exam does not rule out bleeding."),
          opt("Hold imaging until he develops symptoms.",
              "Waiting for symptoms means intervening after the bleed has expanded."),
          opt("Give acetaminophen and reassess in four hours.",
              "Pain control is fine, but it does not address the risk of intracranial hemorrhage."),
        ],
        takeaway="Ask about anticoagulants and antiplatelets for every head injury."),
      dict(label="Change in status",
        update="Forty minutes later, before CT: worsening headache, two episodes of vomiting, the right pupil is larger and sluggish, BP 178/90, HR 52, irregular breathing.",
        prompt="What do you do?",
        options=[
          right("Notify the provider now, raise the head of the bed to 30°, protect the airway and prepare for anticoagulant reversal and neurosurgery.",
              "Correct. Hypertension, bradycardia and irregular breathing (Cushing triad) plus a new pupil change suggest rising intracranial pressure and possible herniation."),
          opt("Give an antiemetic and recheck in an hour.",
              "Vomiting here is a sign of rising pressure. An hour's delay can be fatal."),
          opt("Give an antihypertensive to bring BP to normal.",
              "The hypertension may be maintaining cerebral perfusion. Blood pressure goals are set by the provider for this situation."),
          opt("Lay him flat to improve blood flow to the brain.",
              "Flat positioning reduces venous drainage and can raise intracranial pressure."),
        ],
        takeaway="A pupil change plus Cushing triad is an emergency. Do not wait for imaging to escalate."),
    ],
    related=["head-injury", "neuro-checks-card"], flags=[],
  ),
]
