// Weight entry validation, kg/lb conversion and unit-mismatch guards (js/dosing.js).
// Run: node --test tests/validation.test.js   (no dependencies)
'use strict';
const test = require('node:test');
const assert = require('assert');
const D = require('../js/dosing.js');
const { DRUGS } = require('../js/drugs.js');

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} !≈ ${b}`);

// ── unit conversion ──
test('kg ↔ lb round-trips', () => {
  near(D.kgToLb(10), 22.0462);
  near(D.toKg(D.kgToLb(37.3), 'lb'), 37.3);
  assert.ok(isNaN(D.kgToLb('x')));
});
test('lb entry is converted, kg entry is not', () => {
  near(D.validateWeight('44', 'lb', 'peds').kg, 19.958, 1e-3);
  assert.strictEqual(D.validateWeight('44', 'kg', 'peds').kg, 44);
});
test('same number means very different weights in kg vs lb', () => {
  const kg = D.validateWeight('100', 'kg', 'adult').kg;
  const lb = D.validateWeight('100', 'lb', 'adult').kg;
  near(kg / lb, D.LB_PER_KG);
});

// ── validation states ──
test('empty input → empty, no message', () => {
  for (const raw of ['', '   ', null, undefined]) {
    const r = D.validateWeight(raw, 'kg', 'adult');
    assert.strictEqual(r.status, 'empty');
    assert.strictEqual(r.message, '');
  }
});
test('non-numbers, zero and negatives are invalid', () => {
  for (const raw of ['abc', '1,5', 'NaN', 'Infinity', '0', '-5', '0.0']) {
    const r = D.validateWeight(raw, 'kg', 'adult');
    assert.strictEqual(r.status, 'invalid', raw);
    assert.ok(r.message, raw);
    assert.ok(isNaN(r.kg), raw);
  }
});
test('outside the plausible range is blocked, in either unit', () => {
  assert.strictEqual(D.validateWeight('0.3', 'kg', 'peds').status, 'implausible');
  assert.strictEqual(D.validateWeight('351', 'kg', 'adult').status, 'implausible');
  assert.strictEqual(D.validateWeight('800', 'lb', 'adult').status, 'implausible'); // 363 kg
  assert.strictEqual(D.validateWeight('0.5', 'lb', 'peds').status, 'implausible'); // 0.23 kg
  assert.match(D.validateWeight('351', 'kg', 'adult').message, /kg\/lb/);
});
test('range edges are accepted', () => {
  assert.strictEqual(D.validateWeight(String(D.WEIGHT_LIMITS.minKg), 'kg', 'peds').status, 'ok');
  assert.strictEqual(D.validateWeight(String(D.WEIGHT_LIMITS.maxKg), 'kg', 'adult').status, 'ok');
});
test('valid weights pass with no warnings in the expected mode', () => {
  const r = D.validateWeight('70', 'kg', 'adult');
  assert.strictEqual(r.status, 'ok');
  assert.deepStrictEqual(r.warnings, []);
  assert.deepStrictEqual(D.validateWeight('18', 'kg', 'peds').warnings, []);
});

// ── unit / population mismatch prompts ──
test('peds weight >100 kg prompts a kg/lb check', () => {
  const r = D.validateWeight('120', 'kg', 'peds');
  assert.strictEqual(r.status, 'ok');
  assert.match(r.warnings.join(' '), /kg vs lb/);
});
test('adult weight <30 kg prompts (e.g. 50 lb typed as lb for an adult)', () => {
  assert.match(D.validateWeight('50', 'lb', 'adult').warnings.join(' '), /pediatric/);
});
test('adult >150 kg in kg mode asks to confirm kg, not lb; same weight in lb mode does not', () => {
  assert.match(D.validateWeight('180', 'kg', 'adult').warnings.join(' '), /not lb/);
  assert.deepStrictEqual(D.validateWeight('180', 'lb', 'adult').warnings, []);
  assert.deepStrictEqual(D.validateWeight('150', 'kg', 'adult').warnings, []);
});

// ── ordered infusion dose ──
test('checkOrderedDose: ok / outside / mismatch / invalid', () => {
  const range = [2, 12];
  assert.strictEqual(D.checkOrderedDose(8, range), 'ok');
  assert.strictEqual(D.checkOrderedDose(2, range), 'ok');
  assert.strictEqual(D.checkOrderedDose(15, range), 'outside');
  assert.strictEqual(D.checkOrderedDose(1, range), 'outside');
  assert.strictEqual(D.checkOrderedDose(120, range), 'mismatch'); // mg read as mcg ×10
  assert.strictEqual(D.checkOrderedDose(0.2, range), 'mismatch');
  assert.strictEqual(D.checkOrderedDose(0, range), 'outside', 'zero is off, not a unit error');
  assert.strictEqual(D.checkOrderedDose(-1, range), 'invalid');
  assert.strictEqual(D.checkOrderedDose(NaN, range), 'invalid');
});
test('every drip start dose sits inside its own reference range', () => {
  for (const d of DRUGS) for (const pop of ['adult', 'peds']) {
    const s = d[pop];
    if (s && s.type === 'infusion') assert.strictEqual(D.checkOrderedDose(s.start, s.range), 'ok', `${d.id} ${pop}`);
  }
});

// ── custom bag concentration ──
test('custom bag 1000× too strong (mcg typed into an mg field) is flagged', () => {
  const norepi = DRUGS.find(d => d.id === 'norepi').adult;
  const unit = norepi.concs[0].unit;
  assert.strictEqual(D.customConcMismatch({ amount: 4, unit, volumeMl: 250 }, norepi.concs, 'mcg'), false);
  assert.strictEqual(D.customConcMismatch({ amount: 4000, unit, volumeMl: 250 }, norepi.concs, 'mcg'), true);
  assert.strictEqual(D.customConcMismatch({ amount: 0, unit, volumeMl: 250 }, norepi.concs, 'mcg'), false);
});

test('decimal comma gets a specific hint instead of a silent misread', () => {
  const r = D.validateWeight('12,5', 'kg', 'peds');
  assert.strictEqual(r.status, 'invalid');
  assert.match(r.message, /decimal point/);
});
