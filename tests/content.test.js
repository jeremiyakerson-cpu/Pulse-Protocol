// Content stamp (js/content.js) and offline precache list (sw.js).
// Run: node --test tests/content.test.js   (no dependencies)
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const C = require('../js/content.js');
const { DRUGS } = require('../js/drugs.js');

const ROOT = path.join(__dirname, '..');

test('content stamp matches the drug data (update js/content.js when js/drugs.js changes)', () => {
  assert.strictEqual(C.fingerprint(DRUGS), C.DATA_FINGERPRINT,
    'js/drugs.js changed: set DATA_UPDATED, DATA_FINGERPRINT (' + C.fingerprint(DRUGS) + ') and CONTENT_VERSION ' +
    'in js/content.js, and reset REVIEW to pending unless the change was clinically signed off');
});

test('content stamp fields are well-formed', () => {
  assert.match(C.CONTENT_VERSION, /^\d{4}\.\d{2}\.\d+$/);
  assert.match(C.DATA_UPDATED, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!isNaN(Date.parse(C.DATA_UPDATED)));
  assert.ok(['pending', 'reviewed'].includes(C.REVIEW.status));
  if (C.REVIEW.status === 'reviewed') {
    assert.match(C.REVIEW.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(C.REVIEW.by, 'reviewed content names who reviewed it');
  }
});

test('fingerprint changes when any dose changes', () => {
  const copy = JSON.parse(JSON.stringify(DRUGS));
  copy[0].adult.dose = copy[0].adult.dose + 1;
  assert.notStrictEqual(C.fingerprint(copy), C.fingerprint(DRUGS));
});

test('guideline years come only from the cited text', () => {
  assert.deepStrictEqual(C.yearsIn('AHA ACLS 2020 / PALS 2020 bradycardia algorithm'), [2020]);
  assert.deepStrictEqual(C.yearsIn('AASLD portal hypertension guidance (2016)'), [2016]);
  assert.deepStrictEqual(C.yearsIn('pathway (rev. 2/2026): 20mg/kg/dose (MAX 1000mg)'), [2026]);
  assert.deepStrictEqual(C.yearsIn('NAEPP EPR-3'), []);
  assert.deepStrictEqual(C.yearsIn('0.2 mL/kg, max 2000.5 units, 1500 mg'), [], 'doses are not years');
  assert.deepStrictEqual(C.yearsIn('2031 draft', 2026), [], 'future years ignored when a max is given');
  assert.deepStrictEqual(C.yearsIn(undefined), []);
});

test('sourceYears for real entries', () => {
  const byId = id => DRUGS.find(d => d.id === id);
  assert.deepStrictEqual(C.sourceYears(byId('atropine')).source, [2020]);
  assert.deepStrictEqual(C.sourceYears(byId('epi_arrest')).source, [], 'undated source stays undated');
});

// ── offline: every local script/stylesheet a page loads must be precached ──
function precacheList() {
  const code = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const sandbox = { self: { addEventListener() {}, location: { origin: '' } } };
  return vm.runInNewContext(code + '\n;({ PRECACHE, CACHE_VERSION })', sandbox);
}

test('every js/css referenced by a page is in sw.js PRECACHE, and exists', () => {
  const { PRECACHE } = precacheList();
  for (const page of ['index.html', 'calculator.html', 'quiz.html']) {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].map(m => m[1]);
    assert.ok(refs.length, page);
    for (const r of refs) {
      assert.ok(PRECACHE.includes(r), `${page} loads ${r} but sw.js does not precache it`);
      assert.ok(fs.existsSync(path.join(ROOT, r)), `${r} missing`);
    }
  }
});

test('CACHE_VERSION keeps the line format the Pages workflow stamps', () => {
  const code = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.match(code, /^const CACHE_VERSION = '[^']*';$/m);
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  assert.match(wf, /const CACHE_VERSION = /);
});
