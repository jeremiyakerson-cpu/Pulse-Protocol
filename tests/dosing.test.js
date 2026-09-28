// Run: node tests/dosing.test.js   (no dependencies)
'use strict';
const assert = require('assert');
const D = require('../js/dosing.js');
const { DRUGS } = require('../js/drugs.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; }
}
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} !≈ ${b}`);
const byId = id => DRUGS.find(d => d.id === id);

// ── unit conversion & rounding ──
test('lb → kg', () => near(D.toKg(154, 'lb'), 69.853, 1e-3));
test('kg passthrough', () => assert.strictEqual(D.toKg(20, 'kg'), 20));
test('invalid weight → NaN', () => { assert.ok(isNaN(D.toKg('', 'kg'))); assert.ok(isNaN(D.toKg(-3, 'kg'))); });
test('roundDose strips float noise', () => {
  assert.strictEqual(D.roundDose(0.1 * 3), 0.3);
  assert.strictEqual(D.roundDose(0.22000000000000003), 0.22);
  assert.strictEqual(D.roundDose(1234.56), 1235);
});
test('mass conversion', () => { assert.strictEqual(D.convertAmount(4, 'mg', 'mcg'), 4000); assert.strictEqual(D.convertAmount(2, 'g', 'mg'), 2000); });
test('incompatible units throw', () => assert.throws(() => D.convertAmount(1, 'units', 'mg')));

// ── weight-based boluses ──
test('peds epi arrest 0.01 mg/kg × 22 kg = 0.22 mg', () => {
  const r = D.weightDose(byId('epi_arrest').peds, 22);
  assert.strictEqual(r.low, 0.22); assert.ok(!r.capped);
});
test('peds epi arrest capped at 1 mg for 120 kg', () => {
  const r = D.weightDose(byId('epi_arrest').peds, 120);
  assert.strictEqual(r.low, 1); assert.ok(r.capped);
});
test('peds epi anaphylaxis capped at 0.3 mg', () => assert.strictEqual(D.weightDose(byId('epi_anaphylaxis').peds, 40).low, 0.3));
test('peds atropine floor 0.1 mg for 3 kg', () => {
  const r = D.weightDose(byId('atropine').peds, 3);
  assert.strictEqual(r.low, 0.1); assert.ok(r.floored);
});
test('peds atropine max 0.5 mg', () => assert.strictEqual(D.weightDose(byId('atropine').peds, 40).low, 0.5));
test('adult atropine is 1 mg (2020 AHA)', () => assert.strictEqual(byId('atropine').adult.dose, 1));
test('peds amiodarone 5 mg/kg × 18 kg = 90 mg', () => assert.strictEqual(D.weightDose(byId('amiodarone_arrest').peds, 18).low, 90));
test('adenosine peds second dose capped at 12 mg', () => {
  const x = byId('adenosine').peds.extras[0];
  assert.strictEqual(D.weightDose(x, 80).low, 12);
  assert.strictEqual(D.weightDose(x, 20).low, 4);
});
test('rocuronium range 1–1.2 mg/kg × 80 kg', () => {
  const r = D.weightDose(byId('rocuronium').adult, 80);
  assert.strictEqual(r.low, 80); assert.strictEqual(r.high, 96);
});
test('alteplase 0.9 mg/kg, 70 kg → 63 mg; bolus 6.3; infusion 56.7', () => {
  const s = byId('alteplase_stroke').adult;
  assert.strictEqual(D.weightDose(s, 70).low, 63);
  assert.strictEqual(D.weightDose(s.extras[0], 70).low, 6.3);
  assert.strictEqual(D.weightDose(s.extras[1], 70).low, 56.7);
});
test('alteplase caps at 90 mg / 9 / 81 for 120 kg', () => {
  const s = byId('alteplase_stroke').adult;
  assert.strictEqual(D.weightDose(s, 120).low, 90);
  assert.strictEqual(D.weightDose(s.extras[0], 120).low, 9);
  assert.strictEqual(D.weightDose(s.extras[1], 120).low, 81);
});
test('tenecteplase stroke 0.25 mg/kg capped at 25 mg', () => {
  assert.strictEqual(D.weightDose(byId('tenecteplase_stroke').adult, 80).low, 20);
  assert.strictEqual(D.weightDose(byId('tenecteplase_stroke').adult, 110).low, 25);
});
test('levetiracetam 60 mg/kg capped at 4500 mg', () => assert.strictEqual(D.weightDose(byId('levetiracetam').adult, 90).low, 4500));
test('NAC 3 bags for 100+ kg cap at 15 g / 5 g / 10 g', () => {
  const s = byId('acetylcysteine').adult;
  assert.strictEqual(D.weightDose(s, 130).low, 15000);
  assert.strictEqual(D.weightDose(s.extras[0], 130).low, 5000);
  assert.strictEqual(D.weightDose(s.extras[1], 130).low, 10000);
});
test('Kcentra INR 4–6 caps at 3500 units (100 kg)', () => assert.strictEqual(D.weightDose(byId('kcentra_4_6').adult, 140).low, 3500));

// ── volumes ──
test('epi 0.22 mg at 1 mg/mL = 0.22 mL', () => near(D.volumeMl(0.22, 1), 0.22));
test('epi arrest 1 mg at 0.1 mg/mL = 10 mL', () => near(D.volumeMl(1, 0.1), 10));
test('volume with bad conc → NaN', () => assert.ok(isNaN(D.volumeMl(1, 0))));

// ── infusions: mL/hr ──
const bag = (amount, unit, volumeMl) => ({ amount, unit, volumeMl });
test('dopamine 5 mcg/kg/min, 80 kg, 400 mg/250 mL → 15 mL/hr', () =>
  near(D.infusionRateMlHr(5, 'mcg/kg/min', bag(400, 'mg', 250), 80), 15));
test('norepi 8 mcg/min, 4 mg/250 mL → 30 mL/hr', () =>
  near(D.infusionRateMlHr(8, 'mcg/min', bag(4, 'mg', 250)), 30));
test('epi 2 mcg/min, 1 mg/250 mL → 30 mL/hr', () =>
  near(D.infusionRateMlHr(2, 'mcg/min', bag(1, 'mg', 250)), 30));
test('nicardipine 5 mg/hr, 20 mg/200 mL → 50 mL/hr', () =>
  near(D.infusionRateMlHr(5, 'mg/hr', bag(20, 'mg', 200)), 50));
test('amiodarone 1 mg/min, 360 mg/200 mL → 33.33 mL/hr', () =>
  near(D.infusionRateMlHr(1, 'mg/min', bag(360, 'mg', 200)), 33.333, 1e-3));
test('vasopressin 0.03 units/min, 20 units/100 mL → 9 mL/hr', () =>
  near(D.infusionRateMlHr(0.03, 'units/min', bag(20, 'units', 100)), 9));
test('heparin 18 units/kg/hr, 70 kg, 100 units/mL → 12.6 mL/hr', () =>
  near(D.infusionRateMlHr(18, 'units/kg/hr', bag(25000, 'units', 250), 70), 12.6));
test('insulin 0.1 units/kg/hr, 70 kg, 1 unit/mL → 7 mL/hr', () =>
  near(D.infusionRateMlHr(0.1, 'units/kg/hr', bag(100, 'units', 100), 70), 7));
test('propofol 20 mcg/kg/min, 70 kg, 10 mg/mL → 8.4 mL/hr', () =>
  near(D.infusionRateMlHr(20, 'mcg/kg/min', bag(1000, 'mg', 100), 70), 8.4));
test('nitroglycerin 10 mcg/min, 200 mcg/mL → 3 mL/hr', () =>
  near(D.infusionRateMlHr(10, 'mcg/min', bag(50, 'mg', 250)), 3));
test('per-kg infusion without weight → NaN', () => assert.ok(isNaN(D.infusionRateMlHr(5, 'mcg/kg/min', bag(400, 'mg', 250)))));
test('doseFromRate inverts infusionRateMlHr', () => {
  const c = bag(4, 'mg', 250);
  near(D.doseFromRate(D.infusionRateMlHr(0.25, 'mcg/kg/min', c, 63), 'mcg/kg/min', c, 63), 0.25);
});
test('bad rate unit throws', () => assert.throws(() => D.parseRateUnit('mg/kg')));

// ── data integrity: every spec is well-formed and every rateUnit/conc pair is convertible ──
test('drug data schema', () => {
  const ids = new Set();
  const TYPES = ['fixed', 'weight', 'tiered', 'infusion', 'text'];
  DRUGS.forEach(d => {
    assert.ok(d.id && !ids.has(d.id), 'duplicate/missing id ' + d.id); ids.add(d.id);
    ['name', 'group', 'conc', 'note', 'source'].forEach(k => assert.ok(typeof d[k] === 'string' && d[k], d.id + ' missing ' + k));
    assert.ok(Array.isArray(d.warnings), d.id + ' warnings');
    assert.ok(d.adult || d.peds, d.id + ' has no dosing');
    ['adult', 'peds'].forEach(pop => {
      const s = d[pop];
      if (!s) return;
      const where = d.id + '.' + pop;
      assert.ok(TYPES.includes(s.type), where + ' bad type');
      assert.ok(typeof s.desc === 'string', where + ' desc');
      if (s.type === 'weight') {
        const r = Array.isArray(s.perKg) ? s.perKg : [s.perKg];
        r.forEach(v => assert.ok(v > 0, where + ' perKg'));
        if (s.max != null && s.min != null) assert.ok(s.min < s.max, where + ' min<max');
      }
      if (s.type === 'infusion') {
        const u = D.parseRateUnit(s.rateUnit);
        assert.ok(s.range[0] <= s.range[1] && s.start >= s.range[0] && s.start <= s.range[1], where + ' start within range');
        s.concs.forEach(c => assert.ok(D.concPerMl(c, u.amount) > 0, where + ' conc'));
        const kg = u.perKg ? 70 : undefined;
        assert.ok(isFinite(D.infusionRateMlHr(s.start, s.rateUnit, s.concs[0], kg)), where + ' rate');
      }
    });
  });
  assert.ok(DRUGS.length >= 50, 'expected ≥50 drugs, got ' + DRUGS.length);
});

console.log(`${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
