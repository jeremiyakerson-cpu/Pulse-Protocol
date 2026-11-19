// Validation harness: accumulates every problem and prints them all at the end.
// Invariant-based: no hard-coded content counts. Run: node tools/validate.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const L = require(path.join(ROOT, 'src/js/logic.js'));
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/content.json'), 'utf8'));
const errs = []; let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) errs.push(msg); };
const uniq = (list, what) => { const s = new Set(); list.forEach(x => { ok(!s.has(x.id), `${what}: duplicate id ${x.id}`); s.add(x.id); }); };
const nonEmpty = s => typeof s === 'string' && s.trim().length > 0;

// ---- cases ----
uniq(D.cases, 'case');
const indexIds = new Set(D.index.map(e => e.id));
const kinds = new Set(D.cases.map(c => c.kind));
ok(kinds.has('urgent') && kinds.has('deterioration'), 'cases: must mix urgent-care and deterioration cases');
D.cases.forEach(c => {
  const id = `case ${c.id}`;
  ['section', 'title', 'patient', 'vignette'].forEach(k => ok(nonEmpty(c[k]), `${id}: missing ${k}`));
  ok(['urgent', 'deterioration'].includes(c.kind), `${id}: bad kind ${c.kind}`);
  ok(c.stages.length >= 2, `${id}: staged cases need at least 2 stages`);
  if (c.kind === 'deterioration') ok(c.stages.some(s => s.update), `${id}: deterioration case has no status-change update`);
  c.related.forEach(r => ok(indexIds.has(r), `${id}: related index id "${r}" does not exist`));
  c.stages.forEach((s, i) => {
    const sid = `${id} stage ${i + 1}`;
    ok(nonEmpty(s.prompt) && nonEmpty(s.label) && nonEmpty(s.takeaway), `${sid}: missing prompt/label/takeaway`);
    ok(s.options.length >= 3 && s.options.length <= 4, `${sid}: needs 3-4 options (staged MCQ), has ${s.options.length}`);
    ok(s.options.filter(o => o.ok).length === 1, `${sid}: must have exactly one correct option`);
    s.options.forEach((o, j) => {
      ok(nonEmpty(o.t), `${sid} option ${j + 1}: empty text`);
      ok(nonEmpty(o.why) && o.why.length >= 30, `${sid} option ${j + 1}: rationale missing or too thin (wrong answers must say why)`);
    });
    // Commit before reveal: nothing about the answer is exposed before commit.
    const pre = L.stageState(s, 0, false);
    ok(pre.correctIdx === null && pre.correct === null && !pre.revealed, `${sid}: answer exposed before commit`);
    ok(L.stageState(s, null, false).canCommit === false, `${sid}: commit allowed with no pick`);
    // Answer key for dosing must match the vetted table.
    if (s.dose_check) {
      const entry = D.dosing.find(d => d.id === s.dose_check.entry);
      ok(!!entry, `${sid}: dose_check entry ${s.dose_check.entry} not in table`);
      if (entry) {
        const r = L.calcDose(entry, s.dose_check.weight);
        const correct = s.options.find(o => o.ok);
        ok(r.ok && correct.t.includes(`${r.dose} ${r.unit}`), `${sid}: answer key "${correct.t}" does not match table dose ${r.dose} ${r.unit}`);
      }
    }
  });
});

// ---- index ----
uniq(D.index, 'index');
D.index.forEach(e => {
  const id = `index ${e.id}`;
  ok(['topic', 'card'].includes(e.kind), `${id}: bad kind`);
  ['title', 'category', 'summary'].forEach(k => ok(nonEmpty(e[k]), `${id}: missing ${k}`));
  ok(e.interventions.length > 0 && e.assess.length > 0, `${id}: needs assess and interventions bullets`);
  [...e.assess, ...e.interventions, ...e.pitfalls].forEach(b => ok(nonEmpty(b), `${id}: empty bullet`));
});
ok(D.index.some(e => e.id === 'esi-card' && e.flags.some(f => /v4/.test(f) && /v5/.test(f))), 'index: ESI v4/v5 version conflict must be flagged');

// ---- dosing table ----
uniq(D.dosing, 'dosing');
D.dosing.forEach(d => {
  const id = `dosing ${d.id}`;
  ['drug', 'indication', 'route', 'unit', 'source', 'provenance'].forEach(k => ok(nonEmpty(d[k]), `${id}: missing ${k}`));
  ok(d.per_kg > 0 && d.max_dose > 0, `${id}: per_kg and max_dose must be positive`);
  ok(typeof d.verified === 'boolean', `${id}: verified must be boolean`);
  ok(!d.verified || nonEmpty(d.signoff), `${id}: verified entries need a signoff`);
  ok(d.conc == null || (d.conc > 0 && nonEmpty(d.conc_label)), `${id}: concentration needs a label`);
  ok(!/heparin/i.test(d.drug + d.id), `${id}: heparin must never be in the calculator table`);
  // Cap invariant: no weight can exceed max_dose.
  [0.5, 3, 10, 25, 70, 150].forEach(w => { const r = L.calcDose(d, w); ok(r.ok && r.dose <= d.max_dose, `${id}: dose at ${w} kg exceeds max`); });
});
ok(D.excluded.some(x => /heparin/i.test(x.drug)), 'dosing: heparin exclusion notice missing');

// ---- logic ----
ok(L.map(120, 80) === 93, 'logic: MAP 120/80 should be 93');
ok(L.map(80, 90) === null, 'logic: MAP must reject DBP >= SBP');
const pk = L.parkland(70, 20); ok(pk && pk.total === 5600 && pk.first8 === 2800 && pk.first8Rate === 350, 'logic: Parkland 70 kg 20% wrong');
const dr = L.dripRate(1000, 8, 15); ok(dr && dr.mlHr === 125 && dr.gttMin === 31, 'logic: drip 1000 mL/8 h @15 wrong');
ok(Math.abs(L.toKg(22.0462, 'lb') - 10) < 1e-9, 'logic: lb to kg wrong');
ok(!L.calcDose(D.dosing[0], 0).ok && !L.calcDose(D.dosing[0], 400).ok, 'logic: out-of-range weights must be rejected');

// ---- app source: offline, no network (PHI rule: nothing leaves the device) ----
const app = fs.readFileSync(path.join(ROOT, 'src/js/app.js'), 'utf8');
[/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /EventSource/].forEach(re => ok(!re.test(app), `app.js: network API ${re} found`));
['dist/index.html', 'dist/artifact.html'].forEach(f => {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { ok(false, `${f}: not built`); return; }
  const html = fs.readFileSync(p, 'utf8');
  ok(!/\/\*(CSS|THEME|DATA|LOGIC|APP)\*\//.test(html), `${f}: unfilled placeholder`);
  ok(!/<script[^>]+src=|<link[^>]+stylesheet/.test(html), `${f}: external resource (must work offline)`);
  ['skip-link', 'id="main"', 'aria-label="Tabs"'].forEach(s => ok(html.includes(s), `${f}: missing ${s}`));
  ok(!/,,/.test(fs.readFileSync(path.join(ROOT, 'build/content.js'), 'utf8')), 'content.js: double comma');
});

const bullets = D.index.reduce((n, e) => n + e.interventions.length, 0);
console.log(`${checks} checks · ${D.cases.length} cases · ${D.index.length} index entries · ${bullets} intervention bullets · ${D.dosing.length} dosing entries`);
if (errs.length) { console.log(`\n${errs.length} problem(s):`); errs.forEach(e => console.log('  ✗ ' + e)); process.exit(1); }
console.log('All checks passed.');
