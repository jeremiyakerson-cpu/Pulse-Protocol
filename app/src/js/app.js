// Pulse & Protocol app: Test, Index, Calculators.
// Offline by design: this file makes no network calls (validate.js enforces it).
(function () {
  'use strict';
  var D = window.PP_DATA, L = window.PPLogic;
  var main = document.getElementById('main');
  var STORE = 'pp-progress-v1';

  // ---------- helpers ----------
  function h(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function save(p) { try { localStorage.setItem(STORE, JSON.stringify(p)); } catch (e) {} }
  var progress = load();

  var SECTION_CODE = {
    'Cardiovascular': 'CV', 'Respiratory': 'RS', 'Neurological': 'NE', 'Medical emergencies': 'ME',
    'Musculoskeletal and wound': 'MS', 'Pediatrics': 'PD', 'Triage': 'TR',
    'Gastrointestinal': 'GI', 'Obstetric and gynecologic': 'OB', 'Toxicology': 'TX', 'Ocular and ENT': 'EY'
  };
  function code(section) { return SECTION_CODE[section] || section.slice(0, 2).toUpperCase(); }
  function kindChip(kind) {
    return kind === 'deterioration'
      ? '<span class="chip accent-amber-chip">Deterioration</span>'
      : '<span class="chip accent-teal-chip">Urgent care</span>';
  }
  function shuffle(n) {
    var a = []; for (var i = 0; i < n; i++) a.push(i);
    for (var j = n - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)); var t = a[j]; a[j] = a[k]; a[k] = t; }
    return a;
  }
  function groupBy(list, key) {
    var out = [], seen = {};
    list.forEach(function (x) { var k = x[key]; if (!seen[k]) { seen[k] = []; out.push([k, seen[k]]); } seen[k].push(x); });
    return out;
  }
  function header(eyebrow, title, sub, backHtml) {
    return '<div class="page-head">' + (backHtml || '') + '<div class="eyebrow">' + h(eyebrow) + '</div>' +
      '<h1 class="page-title">' + title + '</h1>' + (sub ? '<p class="page-sub">' + h(sub) + '</p>' : '') + '</div>';
  }
  function back(href, label) { return '<a class="back-link" href="#' + href + '"><span aria-hidden="true">‹</span> ' + h(label) + '</a>'; }

  // ---------- Test tab ----------
  var testFilter = 'all';
  function viewTest() {
    var cases = D.cases.filter(function (c) { return testFilter === 'all' || c.kind === testFilter; });
    var done = D.cases.filter(function (c) { return progress[c.id] && progress[c.id].done; });
    var right = 0, total = 0;
    done.forEach(function (c) { right += progress[c.id].score; total += c.stages.length; });
    var pct = Math.round(done.length / D.cases.length * 100);
    var html = header('Test', 'Cases', D.cases.length + ' fictional patients. Commit to an answer before you see the rationale.');
    html += '<section class="card stat-card" aria-label="Your progress"><div class="row">' +
      '<div><div class="label">Completed</div><div class="stat"><span class="big-num">' + done.length + '</span><span class="big-unit">/ ' + D.cases.length + '</span></div></div>' +
      '<div class="stat-right"><div class="label">Stages correct</div><div class="stat-sm mono">' + (total ? right + ' / ' + total : '—') + '</div></div></div>' +
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Cases completed"><span style="width:' + pct + '%"></span></div></section>';
    html += '<div class="field"><span class="label" id="tf-label">Show</span><div class="segmented" role="group" aria-labelledby="tf-label">' +
      [['all', 'All'], ['urgent', 'Urgent care'], ['deterioration', 'Deterioration']].map(function (o) {
        return '<button type="button" data-tf="' + o[0] + '" aria-pressed="' + (testFilter === o[0]) + '">' + o[1] + '</button>';
      }).join('') + '</div></div>';
    groupBy(cases, 'section').forEach(function (g) {
      html += '<h2 class="section-label">' + h(g[0]) + '</h2>';
      g[1].forEach(function (c) {
        var p = progress[c.id];
        var status = p && p.done ? '<span class="chip">' + p.score + '/' + c.stages.length + '</span>' : '';
        html += '<a class="link-card" href="#case-' + c.id + '"><span class="link-left">' +
          '<span class="link-icon code-tile' + (c.kind === 'deterioration' ? ' accent-amber' : '') + '" aria-hidden="true">' + code(c.section) + '</span>' +
          '<span class="min0"><span class="link-title">' + h(c.title) + '</span><span class="link-sub">' + h(c.patient) + ' · ' + c.stages.length + ' stages</span></span></span>' +
          '<span class="link-end">' + status + '<span class="arrow" aria-hidden="true">›</span></span></a>';
      });
    });
    main.innerHTML = html;
    main.querySelectorAll('[data-tf]').forEach(function (b) {
      b.addEventListener('click', function () { testFilter = b.getAttribute('data-tf'); viewTest(); });
    });
  }

  // ---------- Case player (commit before reveal) ----------
  var run = null; // { id, stage, picks[], committed[], order[][] }
  function startRun(c) {
    run = { id: c.id, stage: 0, picks: [], committed: [], order: c.stages.map(function (s) { return shuffle(s.options.length); }) };
  }
  function viewCase(id) {
    var c = byId(D.cases, id);
    if (!c) return notFound();
    if (!run || run.id !== id) startRun(c);
    var html = header(c.section, h(c.title), null, back('test', 'Cases'));
    html += '<div class="chip-row">' + kindChip(c.kind) + '<span class="chip neutral-chip">' + h(c.patient) + '</span></div>';
    html += '<section class="card"><div class="note-title">Presentation</div><p class="body-soft">' + h(c.vignette) + '</p>' + vitals(c.vitals) + '</section>';
    for (var i = 0; i <= run.stage && i < c.stages.length; i++) html += stageHtml(c, i);
    if (run.committed.length === c.stages.length && run.committed.every(Boolean)) html += summaryHtml(c);
    html += '<p class="fine center">Fictional patient. Educational use only, not clinical decision support.</p>';
    main.innerHTML = html;
    bindCase(c);
  }
  function vitals(v) {
    var labels = { HR: 'HR', BP: 'BP', RR: 'RR', SpO2: 'SpO₂', Temp: 'Temp', Pain: 'Pain', Weight: 'Weight' };
    var units = { HR: '/min', RR: '/min', SpO2: '%', Temp: '°C', BP: '' };
    return '<dl class="vitals">' + Object.keys(v).map(function (k) {
      return '<div><dt>' + labels[k] + '</dt><dd class="mono">' + h(v[k]) + '<small>' + (units[k] || '') + '</small></dd></div>';
    }).join('') + '</dl>';
  }
  function stageHtml(c, i) {
    var s = c.stages[i], st = L.stageState(s, run.picks[i], run.committed[i]);
    var html = '<section class="card stage" id="stage-' + i + '" aria-labelledby="stage-' + i + '-q">';
    html += '<div class="eyebrow">Stage ' + (i + 1) + ' of ' + c.stages.length + ' · ' + h(s.label) + '</div>';
    if (s.update) html += '<div class="update-box"><div class="note-title">New findings</div><p>' + h(s.update) + '</p></div>';
    html += '<p class="question" id="stage-' + i + '-q">' + h(s.prompt) + '</p>';
    html += '<div class="opts" role="group" aria-labelledby="stage-' + i + '-q">';
    run.order[i].forEach(function (oi, pos) {
      var o = s.options[oi], cls = 'opt', mark = '';
      if (st.revealed) {
        if (o.ok) { cls += ' correct'; mark = '<span class="mark ok">Correct</span>'; }
        else if (oi === run.picks[i]) { cls += ' wrong'; mark = '<span class="mark no">Your answer</span>'; }
        else cls += ' dim-soft';
      }
      html += '<div class="opt-wrap"><button type="button" class="' + cls + '" data-stage="' + i + '" data-opt="' + oi + '"' +
        (st.revealed ? ' disabled' : '') + ' aria-pressed="' + (run.picks[i] === oi) + '">' +
        '<span class="opt-letter mono" aria-hidden="true">' + 'ABCD'[pos] + '</span><span class="opt-text">' + h(o.t) + '</span>' + mark + '</button>' +
        (st.revealed ? '<p class="explain' + (o.ok ? ' ok' : '') + '">' + h(o.why) + '</p>' : '') + '</div>';
    });
    html += '</div>';
    if (!st.revealed) {
      html += '<button type="button" class="btn btn-primary btn-block btn-lg" data-commit="' + i + '"' + (st.canCommit ? '' : ' disabled') + '>Lock in answer</button>' +
        '<p class="fine center hint">The rationale stays hidden until you commit.</p>';
    } else {
      html += '<div class="result-line ' + (st.correct ? 'ok' : 'no') + '" role="status">' + (st.correct ? 'Correct.' : 'Not quite. Read why each option is right or wrong above.') + '</div>';
      html += '<div class="note-box takeaway"><div class="note-title">Takeaway</div><div class="note-body">' + h(s.takeaway) + '</div></div>';
      if (i === run.stage && i < c.stages.length - 1) html += '<button type="button" class="btn btn-primary btn-block btn-lg" data-next>Next stage</button>';
    }
    return html + '</section>';
  }
  function summaryHtml(c) {
    var score = run.picks.filter(function (p, i) { return c.stages[i].options[p].ok; }).length;
    var html = '<section class="card summary" id="summary" aria-live="polite"><div class="eyebrow"><span class="dot" aria-hidden="true"></span> Case complete</div>' +
      '<div class="summary-score"><span class="big-num">' + score + '</span><span class="big-unit">/ ' + c.stages.length + ' stages correct</span></div>';
    if (c.flags.length) html += c.flags.map(function (f) {
      return '<div class="disclaimer" role="note"><span class="ico" aria-hidden="true">⚠︎</span><p><strong>Guideline note.</strong> ' + h(f) + '</p></div>';
    }).join('');
    var rel = c.related.map(function (r) { return byId(D.index, r); }).filter(Boolean);
    if (rel.length) html += '<div class="label">Review in the Index</div>' + rel.map(function (e) {
      return '<a class="link-card compact" href="#entry-' + e.id + '"><span class="link-title">' + h(e.title) + '</span><span class="arrow" aria-hidden="true">›</span></a>';
    }).join('');
    html += '<div class="btn-row"><button type="button" class="btn btn-ghost" data-retry>Try again</button><a class="btn btn-primary" href="#test">Back to cases</a></div>';
    return html + '</section>';
  }
  function bindCase(c) {
    main.querySelectorAll('.opt[data-opt]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.getAttribute('data-stage');
        if (run.committed[i]) return;
        run.picks[i] = +b.getAttribute('data-opt');
        viewCase(c.id); focusSel('.opt[data-stage="' + i + '"][data-opt="' + run.picks[i] + '"]');
      });
    });
    var commit = main.querySelector('[data-commit]');
    if (commit) commit.addEventListener('click', function () {
      var i = +commit.getAttribute('data-commit');
      if (run.picks[i] == null) return;
      run.committed[i] = true;
      if (run.committed.length === c.stages.length && run.committed.every(Boolean)) {
        var score = run.picks.filter(function (p, k) { return c.stages[k].options[p].ok; }).length;
        progress[c.id] = { done: true, score: score }; save(progress);
      }
      viewCase(c.id);
      var last = run.committed.length === c.stages.length && run.committed.every(Boolean);
      focusSel(last ? '#summary' : '#stage-' + i + ' .result-line');
    });
    var next = main.querySelector('[data-next]');
    if (next) next.addEventListener('click', function () { run.stage++; viewCase(c.id); focusSel('#stage-' + run.stage); });
    var retry = main.querySelector('[data-retry]');
    if (retry) retry.addEventListener('click', function () { startRun(c); viewCase(c.id); focusSel('#stage-0'); });
  }
  function focusSel(sel) {
    var el = main.querySelector(sel); if (!el) return;
    if (!el.hasAttribute('tabindex') && el.tagName !== 'BUTTON') el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  // ---------- Index tab ----------
  var idxQuery = '', idxKind = 'all';
  function viewIndex() {
    var bullets = D.index.reduce(function (n, e) { return n + e.interventions.length; }, 0);
    var html = header('Index', 'Reference', D.index.length + ' entries · ' + bullets + ' nursing intervention bullets');
    html += '<div class="field"><label class="label" for="idx-search">Search</label>' +
      '<input class="input" id="idx-search" type="search" placeholder="Sepsis, ECG, potassium…" autocomplete="off" value="' + h(idxQuery) + '"></div>';
    html += '<div class="field"><span class="label" id="ik-label">Type</span><div class="segmented" role="group" aria-labelledby="ik-label">' +
      [['all', 'All'], ['topic', 'Topics'], ['card', 'Reference cards']].map(function (o) {
        return '<button type="button" data-ik="' + o[0] + '" aria-pressed="' + (idxKind === o[0]) + '">' + o[1] + '</button>';
      }).join('') + '</div></div><div id="idx-results" aria-live="polite"></div>';
    main.innerHTML = html;
    var input = document.getElementById('idx-search');
    input.addEventListener('input', function () { idxQuery = input.value; renderIndexList(); });
    main.querySelectorAll('[data-ik]').forEach(function (b) {
      b.addEventListener('click', function () {
        idxKind = b.getAttribute('data-ik');
        main.querySelectorAll('[data-ik]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        renderIndexList();
      });
    });
    renderIndexList();
  }
  function renderIndexList() {
    var q = idxQuery.trim().toLowerCase();
    var list = D.index.filter(function (e) {
      if (idxKind !== 'all' && e.kind !== idxKind) return false;
      if (!q) return true;
      return [e.title, e.category, e.summary].concat(e.assess, e.interventions).join(' ').toLowerCase().indexOf(q) !== -1;
    });
    var out = document.getElementById('idx-results');
    if (!list.length) { out.innerHTML = '<div class="card-dashed empty">No entries match “' + h(idxQuery) + '”. Try a shorter word.</div>'; return; }
    var html = '';
    groupBy(list.slice().sort(function (a, b) { return a.category.localeCompare(b.category); }), 'category').forEach(function (g) {
      html += '<h2 class="section-label">' + h(g[0]) + '</h2>';
      g[1].forEach(function (e) {
        html += '<a class="link-card" href="#entry-' + e.id + '"><span class="link-left">' +
          '<span class="link-icon code-tile' + (e.kind === 'card' ? ' accent-purple' : '') + '" aria-hidden="true">' + code(e.category) + '</span>' +
          '<span class="min0"><span class="link-title">' + h(e.title) + '</span><span class="link-sub">' + (e.kind === 'card' ? 'Reference card · ' : '') + h(e.summary) + '</span></span></span>' +
          '<span class="arrow" aria-hidden="true">›</span></a>';
      });
    });
    out.innerHTML = html;
  }
  function viewEntry(id) {
    var e = byId(D.index, id);
    if (!e) return notFound();
    var html = header(e.category, h(e.title), null, back('index', 'Index'));
    html += '<div class="chip-row">' + (e.kind === 'card' ? '<span class="chip accent-purple-chip">Descriptive reference card</span>' : '<span class="chip accent-teal-chip">Topic</span>') + '</div>';
    html += '<p class="body-soft lead">' + h(e.summary) + '</p>';
    html += e.flags.map(function (f) { return '<div class="disclaimer" role="note"><span class="ico" aria-hidden="true">⚠︎</span><p><strong>Guideline note.</strong> ' + h(f) + '</p></div>'; }).join('');
    function list(title, items, accent) {
      if (!items.length) return '';
      return '<section class="card entry-sec"><h2 class="section-label">' + title + '</h2><ul class="dot-list ' + (accent || '') + '">' +
        items.map(function (x) { return '<li>' + h(x) + '</li>'; }).join('') + '</ul></section>';
    }
    html += list(e.kind === 'card' ? 'Criteria' : 'Assess', e.assess);
    html += list(e.kind === 'card' ? 'How to use it' : 'Nursing interventions', e.interventions, 'dl-green');
    html += list('Pitfalls', e.pitfalls, 'dl-red');
    var cases = D.cases.filter(function (c) { return c.related.indexOf(e.id) !== -1; });
    if (cases.length) html += '<div class="label">Practice with a case</div>' + cases.map(function (c) {
      return '<a class="link-card compact" href="#case-' + c.id + '"><span class="link-title">' + h(c.title) + '</span><span class="arrow" aria-hidden="true">›</span></a>';
    }).join('');
    main.innerHTML = html;
  }

  // ---------- Calculators tab ----------
  var calc = { tool: 'dose', unit: 'kg', weight: '15', med: 'acetaminophen', sbp: '96', dbp: '60',
               pk: '70', tbsa: '20', vol: '1000', hrs: '8', df: '15' };
  function viewCalc() {
    var html = header('Calculators', 'Calculators', 'Dosing comes only from the static reference table.');
    html += '<div class="field"><span class="label" id="ct-label">Tool</span><div class="segmented seg-4" role="group" aria-labelledby="ct-label">' +
      [['dose', 'Dosing'], ['map', 'MAP'], ['parkland', 'Burns'], ['drip', 'Drip rate']].map(function (o) {
        return '<button type="button" data-tool="' + o[0] + '" aria-pressed="' + (calc.tool === o[0]) + '">' + o[1] + '</button>';
      }).join('') + '</div></div><div id="calc-body"></div>';
    main.innerHTML = html;
    main.querySelectorAll('[data-tool]').forEach(function (b) {
      b.addEventListener('click', function () { calc.tool = b.getAttribute('data-tool'); viewCalc(); });
    });
    ({ dose: calcDose, map: calcMap, parkland: calcParkland, drip: calcDrip })[calc.tool]();
  }
  function inputField(id, label, val, note, unit) {
    return '<div class="field"><label class="label" for="' + id + '">' + label + '</label><div class="input-unit">' +
      '<input class="input mono" id="' + id + '" inputmode="decimal" value="' + h(val) + '" autocomplete="off">' +
      (unit ? '<span class="unit" aria-hidden="true">' + unit + '</span>' : '') + '</div>' + (note ? '<div class="field-note">' + note + '</div>' : '') + '</div>';
  }
  function bindInputs(ids, fn) {
    ids.forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      el.addEventListener('input', function () { calc[pair[1]] = el.value; fn(); });
    });
  }
  function num(s) { var n = parseFloat(String(s).replace(',', '.')); return isNaN(n) ? NaN : n; }

  function calcDose() {
    var unverified = D.dosing.filter(function (d) { return !d.verified; }).length;
    var html = '<div class="disclaimer" role="note"><span class="ico" aria-hidden="true">⚠︎</span><p>' +
      (unverified ? unverified + ' of ' + D.dosing.length + ' entries are unverified and awaiting pharmacist sign-off. ' : '') +
      'Educational practice only. Always use your facility\'s formulary and a second check.</p></div>';
    html += '<div class="field"><label class="label" for="dose-med">Medication</label><select class="select" id="dose-med">' +
      groupBy(D.dosing, 'drug').map(function (g) {
        return g[1].map(function (d) {
          return '<option value="' + d.id + '"' + (d.id === calc.med ? ' selected' : '') + '>' + h(d.drug + ' · ' + d.indication) + '</option>';
        }).join('');
      }).join('') + '</select></div>';
    html += '<div class="field"><label class="label" for="dose-wt">Weight</label><div class="weight-row">' +
      '<input class="input mono" id="dose-wt" inputmode="decimal" value="' + h(calc.weight) + '" autocomplete="off">' +
      '<div class="segmented" role="group" aria-label="Weight unit">' + ['kg', 'lb'].map(function (u) {
        return '<button type="button" data-unit="' + u + '" aria-pressed="' + (calc.unit === u) + '">' + u + '</button>';
      }).join('') + '</div></div><div class="field-note" id="wt-note"></div></div>';
    html += '<section class="readout" id="dose-out" aria-live="polite"></section><div id="dose-detail"></div>';
    html += '<section class="card-dashed excluded"><div class="label">Not calculated here</div>' + D.excluded.map(function (x) {
      return '<p class="body-soft"><strong>' + h(x.drug) + '.</strong> ' + h(x.reason) + '</p>';
    }).join('') + '</section>';
    document.getElementById('calc-body').innerHTML = html;
    var sel = document.getElementById('dose-med'), wt = document.getElementById('dose-wt');
    sel.addEventListener('change', function () { calc.med = sel.value; renderDose(); });
    wt.addEventListener('input', function () { calc.weight = wt.value; renderDose(); });
    document.querySelectorAll('[data-unit]').forEach(function (b) {
      b.addEventListener('click', function () {
        calc.unit = b.getAttribute('data-unit');
        document.querySelectorAll('[data-unit]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        renderDose();
      });
    });
    renderDose();
  }
  function renderDose() {
    var d = byId(D.dosing, calc.med), w = num(calc.weight), kg = L.toKg(w, calc.unit);
    var note = document.getElementById('wt-note');
    note.textContent = calc.unit === 'lb' && kg > 0 ? '= ' + L.round(kg, 1) + ' kg. Record weight in kilograms.' : 'Example weight. Replace it with your own practice value.';
    var r = L.calcDose(d, kg), out = document.getElementById('dose-out');
    if (!r.ok) {
      out.innerHTML = '<div class="eyebrow">Dose</div><p class="calc-error">' + h(r.error) + '</p>';
    } else {
      out.innerHTML = '<div class="eyebrow"><span class="dot" aria-hidden="true"></span> ' + h(d.drug) + ' · ' + h(d.route) + '</div>' +
        '<div class="readout-num"><span class="big-num">' + r.dose + '</span><span class="big-unit">' + h(r.unit) + '</span></div>' +
        (r.volumeMl != null ? '<div class="big-desc"><span class="mono">' + r.volumeMl + ' mL</span> of ' + h(d.conc_label) + '</div>' : '') +
        '<div class="chip-row">' + (r.capped ? '<span class="chip accent-amber-chip">Capped at max ' + d.max_dose + ' ' + h(d.unit) + '</span>' : '<span class="chip">' + d.per_kg + ' ' + h(d.unit) + '/kg</span>') +
        (d.verified ? '<span class="chip">Pharmacist verified</span>' : '<span class="chip accent-red-chip">Unverified</span>') + '</div>' +
        r.warnings.filter(function (x) { return x.indexOf('Unverified') !== 0; }).map(function (x) { return '<div class="warn-line">⚠︎ ' + h(x) + '</div>'; }).join('');
    }
    var rows = [['Dose per kg', d.per_kg + ' ' + d.unit + '/kg'], ['Maximum', d.max_dose + ' ' + d.unit], ['Route', d.route], ['Repeat', d.repeat],
      ['Concentration', d.conc_label || '—'], ['Age notes', d.age_note || '—'], ['Notes', d.notes || '—'], ['Source', d.source],
      ['Provenance', d.verified ? 'Signed off: ' + d.signoff : d.provenance]];
    document.getElementById('dose-detail').innerHTML = '<div class="table-wrap"><table class="table"><caption class="visually-hidden">Reference entry</caption><tbody>' +
      rows.map(function (r) { return '<tr><th scope="row">' + h(r[0]) + '</th><td>' + h(r[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  function calcMap() {
    document.getElementById('calc-body').innerHTML =
      '<div class="grid-2">' + inputField('map-sbp', 'Systolic', calc.sbp, null, 'mmHg') + inputField('map-dbp', 'Diastolic', calc.dbp, null, 'mmHg') + '</div>' +
      '<section class="readout" id="map-out" aria-live="polite"></section>' +
      '<div class="note-box"><div class="note-title">Formula</div><div class="note-body mono">MAP = (SBP + 2 × DBP) ÷ 3</div></div>';
    bindInputs([['map-sbp', 'sbp'], ['map-dbp', 'dbp']], renderMap); renderMap();
  }
  function renderMap() {
    var m = L.map(num(calc.sbp), num(calc.dbp)), out = document.getElementById('map-out');
    if (m == null) { out.innerHTML = '<div class="eyebrow">MAP</div><p class="calc-error">Enter a systolic higher than the diastolic.</p>'; return; }
    out.innerHTML = '<div class="eyebrow"><span class="dot" aria-hidden="true"></span> Mean arterial pressure</div>' +
      '<div class="readout-num"><span class="big-num' + (m < 65 ? ' is-low' : '') + '">' + m + '</span><span class="big-unit">mmHg</span></div>' +
      '<div class="big-desc">' + (m < 65 ? 'Below 65, the usual minimum target in septic shock.' : 'At or above the usual minimum target of 65.') + '</div>';
  }

  function calcParkland() {
    document.getElementById('calc-body').innerHTML =
      '<div class="grid-2">' + inputField('pk-wt', 'Weight', calc.pk, null, 'kg') + inputField('pk-tbsa', 'Burned TBSA', calc.tbsa, null, '%') + '</div>' +
      '<section class="readout" id="pk-out" aria-live="polite"></section>' +
      '<div class="note-box"><div class="note-title">Parkland formula</div><div class="note-body"><span class="mono">4 mL × kg × %TBSA</span> of lactated Ringer\'s over 24 h. ' +
      'Count partial- and full-thickness burns only. The clock starts at the time of the burn, not arrival. Titrate to urine output.</div></div>';
    bindInputs([['pk-wt', 'pk'], ['pk-tbsa', 'tbsa']], renderParkland); renderParkland();
  }
  function renderParkland() {
    var r = L.parkland(num(calc.pk), num(calc.tbsa)), out = document.getElementById('pk-out');
    if (!r) { out.innerHTML = '<div class="eyebrow">Fluids</div><p class="calc-error">Enter a weight and a TBSA between 1 and 100%.</p>'; return; }
    out.innerHTML = '<div class="eyebrow"><span class="dot" aria-hidden="true"></span> 24-hour total</div>' +
      '<div class="readout-num"><span class="big-num">' + r.total.toLocaleString() + '</span><span class="big-unit">mL</span></div>' +
      '<dl class="split"><div><dt>First 8 h</dt><dd class="mono">' + r.first8.toLocaleString() + ' mL · ' + r.first8Rate + ' mL/h</dd></div>' +
      '<div><dt>Next 16 h</dt><dd class="mono">' + r.first8.toLocaleString() + ' mL · ' + r.next16Rate + ' mL/h</dd></div></dl>';
  }

  function calcDrip() {
    document.getElementById('calc-body').innerHTML =
      '<div class="grid-2">' + inputField('dr-vol', 'Volume', calc.vol, null, 'mL') + inputField('dr-hrs', 'Time', calc.hrs, null, 'h') + '</div>' +
      '<div class="field"><span class="label" id="df-label">Drop factor (gtt/mL)</span><div class="segmented" role="group" aria-labelledby="df-label">' +
      ['10', '15', '20', '60'].map(function (f) { return '<button type="button" data-df="' + f + '" aria-pressed="' + (calc.df === f) + '">' + f + '</button>'; }).join('') +
      '</div><div class="field-note">60 gtt/mL is microdrip tubing. Check the tubing package.</div></div>' +
      '<section class="readout" id="dr-out" aria-live="polite"></section>';
    bindInputs([['dr-vol', 'vol'], ['dr-hrs', 'hrs']], renderDrip);
    document.querySelectorAll('[data-df]').forEach(function (b) {
      b.addEventListener('click', function () {
        calc.df = b.getAttribute('data-df');
        document.querySelectorAll('[data-df]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        renderDrip();
      });
    });
    renderDrip();
  }
  function renderDrip() {
    var r = L.dripRate(num(calc.vol), num(calc.hrs), num(calc.df)), out = document.getElementById('dr-out');
    if (!r) { out.innerHTML = '<div class="eyebrow">Rate</div><p class="calc-error">Enter a volume and a time above zero.</p>'; return; }
    out.innerHTML = '<div class="eyebrow"><span class="dot" aria-hidden="true"></span> Pump rate</div>' +
      '<div class="readout-num"><span class="big-num">' + r.mlHr + '</span><span class="big-unit">mL/h</span></div>' +
      '<div class="big-desc">Gravity: <span class="mono">' + r.gttMin + ' gtt/min</span> at ' + calc.df + ' gtt/mL</div>';
  }

  // ---------- router ----------
  function notFound() { main.innerHTML = header('Not found', 'Page not found', null, back('test', 'Cases')) + '<div class="card-dashed empty">That page does not exist. It may have been renamed.</div>'; }
  function route() {
    var hash = (location.hash || '#test').slice(1), tab = 'test';
    if (hash.indexOf('case-') === 0) { viewCase(hash.slice(5)); }
    else if (hash.indexOf('entry-') === 0) { tab = 'index'; viewEntry(hash.slice(6)); }
    else if (hash === 'index') { tab = 'index'; viewIndex(); }
    else if (hash === 'calc') { tab = 'calc'; viewCalc(); }
    else { run = null; viewTest(); }
    document.querySelectorAll('.tabbar a').forEach(function (a) {
      if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', route);
  function net() { document.documentElement.classList.toggle('is-offline', !navigator.onLine); }
  window.addEventListener('online', net); window.addEventListener('offline', net); net();
  route();
})();
