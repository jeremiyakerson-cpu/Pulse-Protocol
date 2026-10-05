/*
 * Pulse-Protocol dose math.
 * Pure functions only (no DOM) so they can be unit-tested in Node:
 *   node tests/dosing.test.js
 * In the browser they are exposed as window.PulseDosing.
 */
(function (root) {
  'use strict';

  var LB_PER_KG = 2.20462;

  // Mass units normalised to mcg; everything else (units, mEq, mL, J, g-of-dextrose...) is its own base.
  var MASS_TO_MCG = { mcg: 1, mg: 1000, g: 1000000 };

  function toKg(value, unit) {
    var v = Number(value);
    if (!isFinite(v) || v <= 0) return NaN;
    return unit === 'lb' ? v / LB_PER_KG : v;
  }

  // Rounds for display: more decimals for small numbers, never shows float noise.
  // Half-up on the magnitude; toPrecision() first so 1.005 → 1.01 (1.005 * 100 is 100.49999…).
  function roundDose(x) {
    if (!isFinite(x)) return x;
    var abs = Math.abs(x);
    var places = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
    var f = Math.pow(10, places);
    var r = Math.round(Number((abs * f).toPrecision(12))) / f;
    return x < 0 ? -r : r;
  }

  // Plausibility prompts for an entered weight. These never change a dose — they ask the user to re-check.
  var WEIGHT_LIMITS = { minKg: 0.4, maxKg: 350, pedsMaxKg: 100, adultMinKg: 30 };
  function weightWarnings(kg, mode) {
    var out = [];
    if (!(kg > 0) || !isFinite(kg)) return out;
    if (kg < WEIGHT_LIMITS.minKg || kg > WEIGHT_LIMITS.maxKg) {
      out.push('Weight ' + roundDose(kg) + ' kg is outside the plausible range (' + WEIGHT_LIMITS.minKg + '–' +
        WEIGHT_LIMITS.maxKg + ' kg) — check the value and the kg/lb setting.');
    } else if (mode === 'peds' && kg > WEIGHT_LIMITS.pedsMaxKg) {
      out.push('Pediatric mode with weight >' + WEIGHT_LIMITS.pedsMaxKg + ' kg — confirm kg vs lb, and consider adult dosing.');
    } else if (mode === 'adult' && kg < WEIGHT_LIMITS.adultMinKg) {
      out.push('Adult mode with weight <' + WEIGHT_LIMITS.adultMinKg + ' kg — confirm the weight, or switch to pediatric dosing.');
    }
    return out;
  }

  function kgToLb(kg) {
    var v = Number(kg);
    return isFinite(v) ? v * LB_PER_KG : NaN;
  }

  // Above this (in kg mode) a weight is still plausible, but often a pound value typed with kg selected.
  var LIKELY_LB_KG = 150;

  /*
   * Validates a raw weight entry (the input's string value) in the selected unit.
   * Returns { status, kg, message, warnings }:
   *   'empty'       — nothing entered (no message)
   *   'invalid'     — not a number, zero or negative: no dose may be shown
   *   'implausible' — outside WEIGHT_LIMITS.minKg–maxKg: no dose may be shown
   *   'ok'          — kg is usable; warnings are re-check prompts that never change a dose
   */
  function validateWeight(raw, unit, mode) {
    var text = raw == null ? '' : String(raw).trim();
    if (text === '') return { status: 'empty', kg: NaN, message: '', warnings: [] };
    var v = Number(text);
    if (!isFinite(v)) {
      return {
        status: 'invalid', kg: NaN, warnings: [],
        message: /^[\d\s]*,[\d\s]*$/.test(text) ? 'Use a decimal point, not a comma (e.g. 12.5).' : 'Weight must be a number.'
      };
    }
    if (v <= 0) return { status: 'invalid', kg: NaN, message: 'Weight must be greater than 0.', warnings: [] };
    var kg = toKg(v, unit);
    if (kg < WEIGHT_LIMITS.minKg || kg > WEIGHT_LIMITS.maxKg) {
      return {
        status: 'implausible', kg: kg, warnings: [],
        message: roundDose(v) + ' ' + (unit === 'lb' ? 'lb' : 'kg') + ' (' + roundDose(kg) + ' kg) is outside ' +
          WEIGHT_LIMITS.minKg + '–' + WEIGHT_LIMITS.maxKg + ' kg — check the number and the kg/lb setting. No dose is shown.'
      };
    }
    var warnings = weightWarnings(kg, mode);
    if (unit !== 'lb' && mode === 'adult' && kg > LIKELY_LB_KG) {
      warnings.push('Over ' + LIKELY_LB_KG + ' kg — confirm this weight is in kg, not lb.');
    }
    return { status: 'ok', kg: kg, message: '', warnings: warnings };
  }

  /*
   * Unit-mismatch guard for an ordered infusion dose against the drug's reference range.
   * 'mismatch' (≥10× the top or ≤1/10 of a non-zero bottom of the range) usually means mcg↔mg,
   * per-min↔per-hr or per-kg confusion; 'outside' is any other out-of-range order.
   */
  var MISMATCH_FACTOR = 10;
  function checkOrderedDose(dose, range) {
    if (!(dose >= 0) || !isFinite(dose)) return 'invalid';
    var lo = range[0], hi = range[1];
    if ((hi > 0 && dose >= hi * MISMATCH_FACTOR) || (lo > 0 && dose > 0 && dose <= lo / MISMATCH_FACTOR)) return 'mismatch';
    if (dose < lo || dose > hi) return 'outside';
    return 'ok';
  }

  /*
   * Unit-mismatch guard for a custom bag: compares its concentration with the preset bags'.
   * Returns true when it is ≥10× stronger or weaker than every preset (e.g. 4000 typed as mg instead of mcg).
   */
  function customConcMismatch(conc, presets, asUnit) {
    var c = concPerMl(conc, asUnit);
    if (!(c > 0)) return false;
    var vals = presets.map(function (p) { return concPerMl(p, asUnit); }).filter(function (x) { return x > 0; });
    if (!vals.length) return false;
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    return c >= hi * MISMATCH_FACTOR || c <= lo / MISMATCH_FACTOR;
  }

  function clamp(x, min, max) {
    var out = x, capped = false, floored = false;
    if (max != null && out > max) { out = max; capped = true; }
    if (min != null && out < min) { out = min; floored = true; }
    return { value: out, capped: capped, floored: floored };
  }

  /*
   * Weight-based bolus dose.
   * spec: { perKg: number | [low, high], min?, max? }
   * Returns { low, high, capped, floored } — low === high for single-value doses.
   */
  function weightDose(spec, kg) {
    if (!(kg > 0) || !isFinite(kg)) return null;
    var range = Array.isArray(spec.perKg) ? spec.perKg : [spec.perKg, spec.perKg];
    var lo = clamp(range[0] * kg, spec.min, spec.max);
    var hi = clamp(range[1] * kg, spec.min, spec.max);
    return {
      low: roundDose(lo.value),
      high: roundDose(hi.value),
      capped: lo.capped || hi.capped,
      floored: lo.floored || hi.floored
    };
  }

  /*
   * Parse a dose-rate unit such as "mcg/kg/min", "mg/hr", "units/kg/hr", "units/min".
   * Returns { amount: 'mcg', perKg: true, per: 'min' }.
   */
  function parseRateUnit(unit) {
    var parts = String(unit).split('/');
    var amount = parts[0];
    var perKg = parts.indexOf('kg') !== -1;
    var per = parts[parts.length - 1];
    if (per !== 'min' && per !== 'hr') throw new Error('Rate unit must end in /min or /hr: ' + unit);
    return { amount: amount, perKg: perKg, per: per };
  }

  // Converts an amount between compatible units (mcg/mg/g, or identical non-mass units).
  function convertAmount(value, from, to) {
    if (from === to) return value;
    if (MASS_TO_MCG[from] && MASS_TO_MCG[to]) return value * MASS_TO_MCG[from] / MASS_TO_MCG[to];
    throw new Error('Cannot convert ' + from + ' to ' + to);
  }

  /*
   * Concentration of a mixed bag/syringe, expressed per mL in the given amount unit.
   * conc: { amount, unit, volumeMl }  e.g. { amount: 4, unit: 'mg', volumeMl: 250 }
   */
  function concPerMl(conc, asUnit) {
    if (!conc || !(conc.amount > 0) || !(conc.volumeMl > 0) || !isFinite(conc.amount) || !isFinite(conc.volumeMl)) return NaN;
    return convertAmount(conc.amount, conc.unit, asUnit || conc.unit) / conc.volumeMl;
  }

  /*
   * Infusion pump rate in mL/hr.
   *   mL/hr = dose [amount/(kg)/time] × weight × (60 if per-min) ÷ concentration [amount/mL]
   */
  function infusionRateMlHr(dose, rateUnit, conc, kg) {
    var u = parseRateUnit(rateUnit);
    if (!(dose >= 0) || !isFinite(dose)) return NaN;
    if (u.perKg && !(kg > 0 && isFinite(kg))) return NaN;
    var perHour = dose * (u.perKg ? kg : 1) * (u.per === 'min' ? 60 : 1);
    return perHour / concPerMl(conc, u.amount);
  }

  // Inverse of infusionRateMlHr: what dose is a given pump rate delivering?
  function doseFromRate(mlHr, rateUnit, conc, kg) {
    var u = parseRateUnit(rateUnit);
    if (!(mlHr >= 0) || !isFinite(mlHr)) return NaN;
    if (u.perKg && !(kg > 0 && isFinite(kg))) return NaN;
    var perHour = mlHr * concPerMl(conc, u.amount);
    return perHour / (u.perKg ? kg : 1) / (u.per === 'min' ? 60 : 1);
  }

  /*
   * Weight-band dose. tiers: [{ minKg?, maxKg?, overKg?, dose }]
   *   minKg / maxKg are inclusive bounds; overKg is an exclusive lower bound (e.g. ">40 kg").
   * Returns the first matching tier, or null when the weight falls in no band.
   */
  function tierFor(spec, kg) {
    if (!(kg > 0) || !isFinite(kg)) return null;
    for (var i = 0; i < spec.tiers.length; i++) {
      var t = spec.tiers[i];
      if (t.minKg != null && kg < t.minKg) continue;
      if (t.maxKg != null && kg > t.maxKg) continue;
      if (t.overKg != null && !(kg > t.overKg)) continue;
      return t;
    }
    return null;
  }

  // Volume to draw up for a bolus: dose ÷ concentration (both in the same amount unit).
  function volumeMl(dose, concentrationPerMl) {
    if (!(concentrationPerMl > 0) || !(dose >= 0)) return NaN;
    return dose / concentrationPerMl;
  }

  var api = {
    LB_PER_KG: LB_PER_KG,
    toKg: toKg,
    kgToLb: kgToLb,
    validateWeight: validateWeight,
    checkOrderedDose: checkOrderedDose,
    customConcMismatch: customConcMismatch,
    LIKELY_LB_KG: LIKELY_LB_KG,
    roundDose: roundDose,
    weightDose: weightDose,
    weightWarnings: weightWarnings,
    WEIGHT_LIMITS: WEIGHT_LIMITS,
    tierFor: tierFor,
    parseRateUnit: parseRateUnit,
    convertAmount: convertAmount,
    concPerMl: concPerMl,
    infusionRateMlHr: infusionRateMlHr,
    doseFromRate: doseFromRate,
    volumeMl: volumeMl
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PulseDosing = api;
})(typeof window !== 'undefined' ? window : this);
