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

// ── pass 2: edge cases ──
test('toKg rejects 0, negative, NaN, Infinity, junk', () => {
  [0, -1, -0.5, NaN, Infinity, -Infinity, 'abc', '', null, undefined].forEach(v =>
    assert.ok(isNaN(D.toKg(v, 'kg')) && isNaN(D.toKg(v, 'lb')), 'accepted ' + v));
});
test('toKg accepts numeric strings; lb uses 2.20462', () => {
  assert.strictEqual(D.toKg('22', 'kg'), 22);
  near(D.toKg('2.20462', 'lb'), 1);
  near(D.toKg(220.462, 'lb'), 100);
});
test('weightDose returns null for 0 / negative / NaN / Infinity kg', () => {
  const s = byId('epi_arrest').peds;
  [0, -5, NaN, Infinity, undefined].forEach(kg => assert.strictEqual(D.weightDose(s, kg), null, String(kg)));
});
test('weightDose tiny neonate (0.5 kg) epi arrest = 0.005 mg, no floor', () => {
  const r = D.weightDose(byId('epi_arrest').peds, 0.5);
  assert.strictEqual(r.low, 0.005); assert.ok(!r.capped && !r.floored);
});
test('weightDose: cap and floor both apply at the edges exactly', () => {
  const at = D.weightDose(byId('atropine').peds, 25);          // 0.02 × 25 = 0.5 → exactly max, not "capped"
  assert.strictEqual(at.low, 0.5); assert.ok(!at.capped);
  const fl = D.weightDose(byId('atropine').peds, 5);           // 0.02 × 5 = 0.1 → exactly min, not "floored"
  assert.strictEqual(fl.low, 0.1); assert.ok(!fl.floored);
});
test('weightDose range where only the high end is capped', () => {
  const r = D.weightDose(byId('magnesium_asthma').peds, 40);   // 25–75 mg/kg × 40 = 1000–3000, max 2000
  assert.strictEqual(r.low, 1000); assert.strictEqual(r.high, 2000); assert.ok(r.capped);
});
test('roundDose tie cases round half-up without float error', () => {
  assert.strictEqual(D.roundDose(1.005), 1.01);
  assert.strictEqual(D.roundDose(2.675), 2.68);
  assert.strictEqual(D.roundDose(0.0005), 0.001);
  assert.strictEqual(D.roundDose(10.05), 10.1);
  assert.strictEqual(D.roundDose(99.95), 100);
  assert.strictEqual(D.roundDose(-1.005), -1.01);
  assert.strictEqual(D.roundDose(0), 0);
});
test('roundDose precision bands: ≥100 → 0 dp, ≥10 → 1, ≥1 → 2, <1 → 3', () => {
  assert.strictEqual(D.roundDose(123.4), 123);
  assert.strictEqual(D.roundDose(12.34), 12.3);
  assert.strictEqual(D.roundDose(1.234), 1.23);
  assert.strictEqual(D.roundDose(0.1234), 0.123);
});
test('roundDose passes NaN/Infinity through', () => { assert.ok(isNaN(D.roundDose(NaN))); assert.strictEqual(D.roundDose(Infinity), Infinity); });
test('concPerMl / infusion reject zero, negative or missing concentration', () => {
  [bag(0, 'mg', 250), bag(4, 'mg', 0), bag(-4, 'mg', 250), bag(4, 'mg', -1), bag(NaN, 'mg', 250), null].forEach(c => {
    assert.ok(isNaN(D.concPerMl(c, 'mcg')), JSON.stringify(c));
    assert.ok(isNaN(D.infusionRateMlHr(8, 'mcg/min', c)), 'rate ' + JSON.stringify(c));
  });
});
test('infusion rejects negative / NaN / Infinity dose and weight', () => {
  const c = bag(400, 'mg', 250);
  assert.ok(isNaN(D.infusionRateMlHr(-1, 'mcg/kg/min', c, 70)));
  assert.ok(isNaN(D.infusionRateMlHr(NaN, 'mcg/kg/min', c, 70)));
  assert.ok(isNaN(D.infusionRateMlHr(Infinity, 'mcg/kg/min', c, 70)));
  assert.ok(isNaN(D.infusionRateMlHr(5, 'mcg/kg/min', c, 0)));
  assert.ok(isNaN(D.infusionRateMlHr(5, 'mcg/kg/min', c, -70)));
  assert.ok(isNaN(D.infusionRateMlHr(5, 'mcg/kg/min', c, Infinity)));
  assert.strictEqual(D.infusionRateMlHr(0, 'mcg/kg/min', c, 70), 0);
});
test('non-per-kg infusion ignores weight entirely', () => {
  const c = bag(4, 'mg', 250);
  assert.strictEqual(D.infusionRateMlHr(8, 'mcg/min', c), D.infusionRateMlHr(8, 'mcg/min', c, 500));
});
test('doseFromRate rejects negative rate', () => assert.ok(isNaN(D.doseFromRate(-1, 'mcg/min', bag(4, 'mg', 250)))));
test('mcg/kg/min ↔ mL/hr hand checks across unit systems', () => {
  // norepi 0.1 mcg/kg/min × 80 kg × 60 = 480 mcg/hr ÷ 16 mcg/mL = 30 mL/hr
  near(D.infusionRateMlHr(0.1, 'mcg/kg/min', bag(4, 'mg', 250), 80), 30);
  // same bag written in mcg or g must give the same rate
  near(D.infusionRateMlHr(0.1, 'mcg/kg/min', bag(4000, 'mcg', 250), 80), 30);
  near(D.infusionRateMlHr(0.1, 'mcg/kg/min', bag(0.004, 'g', 250), 80), 30);
  // esmolol 50 mcg/kg/min × 70 kg × 60 = 210,000 mcg/hr = 210 mg/hr ÷ 10 mg/mL = 21 mL/hr
  near(D.infusionRateMlHr(50, 'mcg/kg/min', bag(2500, 'mg', 250), 70), 21);
  // amiodarone 0.5 mg/min × 60 = 30 mg/hr ÷ 1.8 mg/mL = 16.67 mL/hr
  near(D.infusionRateMlHr(0.5, 'mg/min', bag(360, 'mg', 200), undefined), 16.667, 1e-3);
  // octreotide 50 mcg/hr ÷ 5 mcg/mL = 10 mL/hr
  near(D.infusionRateMlHr(50, 'mcg/hr', bag(500, 'mcg', 100)), 10);
  // pantoprazole 8 mg/hr ÷ 0.8 mg/mL = 10 mL/hr
  near(D.infusionRateMlHr(8, 'mg/hr', bag(80, 'mg', 100)), 10);
});
test('heparin ACS: 12 units/kg/hr capped at 1000 units/hr ↔ 10 mL/hr at 100 units/mL', () => {
  const s = byId('heparin_acs').adult;
  const kg = 100, dose = Math.min(s.start, s.capPerHr / kg);   // 12 × 100 = 1200 > 1000 → 10 units/kg/hr
  near(D.infusionRateMlHr(dose, s.rateUnit, s.concs[0], kg), 10);
  const b = D.weightDose(s.bolus, 100);                        // 60 × 100 = 6000 → capped 4000
  assert.strictEqual(b.low, 4000); assert.ok(b.capped);
});
test('tierFor midazolam IM: <13 none, 13–40 → 5 mg (40 inclusive), >40 → 10 mg', () => {
  const s = byId('midazolam_im').peds;
  assert.strictEqual(D.tierFor(s, 12.9), null);
  assert.strictEqual(D.tierFor(s, 13).dose, 5);
  assert.strictEqual(D.tierFor(s, 40).dose, 5);
  assert.strictEqual(D.tierFor(s, 40.01).dose, 10);
  assert.strictEqual(D.tierFor(s, 0), null);
  assert.strictEqual(D.tierFor(s, NaN), null);
});
test('weightWarnings: implausible, peds-heavy, adult-light, normal', () => {
  assert.strictEqual(D.weightWarnings(70, 'adult').length, 0);
  assert.strictEqual(D.weightWarnings(20, 'peds').length, 0);
  assert.strictEqual(D.weightWarnings(0.2, 'peds').length, 1);
  assert.strictEqual(D.weightWarnings(1000, 'adult').length, 1);
  assert.ok(/pediatric mode/i.test(D.weightWarnings(120, 'peds')[0]));
  assert.ok(/adult mode/i.test(D.weightWarnings(12, 'adult')[0]));
  assert.strictEqual(D.weightWarnings(NaN, 'adult').length, 0);
});

// ── pass 2: sweep every drug × population × weight ──
const WEIGHTS = [0.5, 1, 3, 10, 13, 25, 40, 70, 100, 150, 300, 1e6];
test('sweep: weight doses finite, within [min, max], volumes finite', () => {
  DRUGS.forEach(d => ['adult', 'peds'].forEach(pop => {
    const s = d[pop]; if (!s || s.type !== 'weight') return;
    WEIGHTS.forEach(kg => {
      const where = `${d.id}.${pop}@${kg}kg`;
      [s].concat(s.extras || []).forEach(x => {
        const r = D.weightDose(x, kg);
        assert.ok(isFinite(r.low) && isFinite(r.high) && r.low <= r.high && r.low > 0, where);
        if (x.max != null) assert.ok(r.high <= x.max, where + ' exceeds max');
        if (x.min != null) assert.ok(r.low >= x.min, where + ' below min');
      });
      if (s.perMl) assert.ok(isFinite(D.volumeMl(D.weightDose(s, kg).high, s.perMl)), where + ' volume');
    });
  }));
});
test('sweep: capped drugs actually hit their cap at 1e6 kg', () => {
  DRUGS.forEach(d => ['adult', 'peds'].forEach(pop => {
    const s = d[pop]; if (!s || s.type !== 'weight' || s.max == null) return;
    const r = D.weightDose(s, 1e6);
    assert.strictEqual(r.high, s.max, d.id + '.' + pop); assert.ok(r.capped);
  }));
});
test('sweep: infusion rate finite, monotonic, and round-trips for every conc and weight', () => {
  DRUGS.forEach(d => ['adult', 'peds'].forEach(pop => {
    const s = d[pop]; if (!s || s.type !== 'infusion') return;
    const u = D.parseRateUnit(s.rateUnit);
    s.concs.forEach(c => [1, 10, 70, 150].forEach(kg => {
      const where = `${d.id}.${pop} ${c.label} @${kg}kg`;
      const lo = D.infusionRateMlHr(s.range[0], s.rateUnit, c, kg);
      const hi = D.infusionRateMlHr(s.range[1], s.rateUnit, c, kg);
      assert.ok(isFinite(lo) && isFinite(hi) && lo > 0 && lo <= hi, where);
      near(D.doseFromRate(hi, s.rateUnit, c, kg), s.range[1], 1e-9);
      if (!u.perKg) assert.strictEqual(lo, D.infusionRateMlHr(s.range[0], s.rateUnit, c, 1), where + ' weight leak');
    }));
  }));
});
test('sweep: kg and equivalent lb give identical doses', () => {
  DRUGS.forEach(d => ['adult', 'peds'].forEach(pop => {
    const s = d[pop]; if (!s || s.type !== 'weight') return;
    [5, 22, 88].forEach(kg => {
      const a = D.weightDose(s, D.toKg(kg, 'kg')), b = D.weightDose(s, D.toKg(kg * D.LB_PER_KG, 'lb'));
      assert.deepStrictEqual(a, b, d.id + '.' + pop + '@' + kg);
    });
  }));
});
test('sweep: every tiered spec has non-overlapping bands', () => {
  DRUGS.forEach(d => ['adult', 'peds'].forEach(pop => {
    const s = d[pop]; if (!s || s.type !== 'tiered') return;
    for (let kg = 0.5; kg <= 200; kg += 0.25) {
      const hits = s.tiers.filter(t => D.tierFor({ tiers: [t] }, kg));
      assert.ok(hits.length <= 1, d.id + ' overlapping bands at ' + kg);
    }
  }));
});
test('every drug has a source; review flags and source notes are non-empty strings', () => {
  DRUGS.forEach(d => {
    assert.ok(d.source && d.source.length > 3, d.id);
    if ('review' in d) assert.ok(typeof d.review === 'string' && d.review.length > 10, d.id);
    if ('sourceNote' in d) assert.ok(typeof d.sourceNote === 'string' && d.sourceNote.length > 20, d.id);
  });
});
test('every drug flagged in pass 1 carries a pass-2 source note', () => {
  ['calcium_chloride', 'atropine', 'fentanyl', 'insulin_hyperk', 'dexamethasone_croup', 'txa', 'octreotide']
    .forEach(id => assert.ok(byId(id).sourceNote, id));
});
test('dexamethasone croup 0.6 mg/kg capped at 12 mg (TREKK 2023)', () => {
  assert.strictEqual(D.weightDose(byId('dexamethasone_croup').peds, 15).low, 9);
  const r = D.weightDose(byId('dexamethasone_croup').peds, 30);
  assert.strictEqual(r.low, 12); assert.ok(r.capped);
});
test('peds TXA 15 mg/kg capped at 1 g (RCPCH)', () => assert.strictEqual(D.weightDose(byId('txa').peds, 80).low, 1000));
test('peds insulin hyperK 0.1 units/kg capped at 10 units', () => assert.strictEqual(D.weightDose(byId('insulin_hyperk').peds, 120).low, 10));

console.log(`${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
