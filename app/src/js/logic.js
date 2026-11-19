// Pure logic: no DOM, no network. Loaded by the app and by tools/validate.js in Node.
(function (root) {
  var LB_PER_KG = 2.20462;
  var MIN_KG = 0.5, MAX_KG = 150;

  function round(n, dp) { var f = Math.pow(10, dp); return Math.round(n * f) / f; }
  function doseDp(n) { return n < 1 ? 3 : n < 10 ? 2 : n < 100 ? 1 : 0; }
  function toKg(value, unit) { return unit === 'lb' ? value / LB_PER_KG : value; }

  // Returns { ok, error } or { ok, dose, unit, capped, volumeMl, warnings[] }
  function calcDose(entry, weightKg) {
    if (!entry) return { ok: false, error: 'Pick a medication.' };
    if (!(weightKg > 0)) return { ok: false, error: 'Enter a weight.' };
    if (weightKg < MIN_KG || weightKg > MAX_KG)
      return { ok: false, error: 'Weight must be between ' + MIN_KG + ' and ' + MAX_KG + ' kg. Check the units.' };
    var warnings = [];
    if (entry.min_kg && weightKg < entry.min_kg)
      warnings.push('Below the ' + entry.min_kg + ' kg minimum listed for this entry. Check age restrictions.');
    var raw = entry.per_kg * weightKg;
    var capped = raw > entry.max_dose;
    var dose = capped ? entry.max_dose : raw;
    dose = round(dose, doseDp(dose));
    var volumeMl = entry.conc ? round(dose / entry.conc, 2) : null;
    if (!entry.verified) warnings.push('Unverified entry: not yet signed off by a pharmacist.');
    return { ok: true, dose: dose, unit: entry.unit, capped: capped, volumeMl: volumeMl, warnings: warnings };
  }

  function map(sbp, dbp) {
    if (!(sbp > 0 && dbp > 0) || dbp >= sbp) return null;
    return Math.round((sbp + 2 * dbp) / 3);
  }

  // Parkland: 4 mL x kg x %TBSA over 24 h, half in the first 8 h from time of burn.
  function parkland(kg, tbsa) {
    if (!(kg > 0) || !(tbsa > 0) || tbsa > 100) return null;
    var total = 4 * kg * tbsa;
    return { total: Math.round(total), first8: Math.round(total / 2), first8Rate: Math.round(total / 2 / 8),
             next16Rate: Math.round(total / 2 / 16) };
  }

  function dripRate(volumeMl, hours, dropFactor) {
    if (!(volumeMl > 0) || !(hours > 0)) return null;
    var mlHr = volumeMl / hours;
    return { mlHr: round(mlHr, 1), gttMin: dropFactor ? Math.round(mlHr * dropFactor / 60) : null };
  }

  // Commit-before-reveal state machine for one stage.
  function stageState(stage, picked, committed) {
    var correctIdx = stage.options.findIndex(function (o) { return o.ok; });
    return { canCommit: picked != null && !committed, revealed: !!committed,
             correct: committed ? picked === correctIdx : null, correctIdx: committed ? correctIdx : null };
  }

  var api = { LB_PER_KG: LB_PER_KG, MIN_KG: MIN_KG, MAX_KG: MAX_KG, toKg: toKg, calcDose: calcDose,
              map: map, parkland: parkland, dripRate: dripRate, stageState: stageState, round: round };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PPLogic = api;
})(this);
