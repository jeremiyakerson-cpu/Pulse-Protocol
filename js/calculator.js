/*
 * ER Dosing Reference — page controller for calculator.html.
 * Data: js/drugs.js (window.PulseDrugs). Math & validation: js/dosing.js (window.PulseDosing).
 * Memory (favorites, recents, kg/lb, remembered patient) and search: js/calcprefs.js (window.PulseCalcPrefs).
 * Content stamp: js/content.js (window.PulseContent).
 */
(function () {
  'use strict';

  var D = window.PulseDosing;
  var P = window.PulseCalcPrefs;
  var C = window.PulseContent;
  var DRUGS = window.PulseDrugs.DRUGS;
  var BY_ID = {};
  DRUGS.forEach(function (d) { BY_ID[d.id] = d; });

  var VITALS_REF = [
    { age: 'Newborn', hr: '100–180', rr: '30–60', sbp: '60–90' },
    { age: 'Infant (1–12mo)', hr: '100–160', rr: '24–38', sbp: '70–100' },
    { age: 'Toddler (1–3yr)', hr: '90–150', rr: '22–30', sbp: '80–110' },
    { age: 'Child (3–12yr)', hr: '70–120', rr: '18–24', sbp: '90–120' },
    { age: 'Adolescent (12+)', hr: '60–100', rr: '12–20', sbp: '100–120' },
    { age: 'Adult', hr: '60–100', rr: '12–20', sbp: '90–120' }
  ];

  var storage = null;
  try { storage = window.localStorage; } catch (e) { /* blocked: prefs fall back to memory */ }
  var prefs = P.createPrefs({ storage: storage, knownIds: DRUGS.map(function (d) { return d.id; }) });

  var recentIds = prefs.getRecents();
  var state = {
    drugId: recentIds[0] || DRUGS[0].id,
    mode: 'adult',
    unit: prefs.getUnit(),
    pending: null       // remembered patient awaiting "same patient?" — its weight is not used until confirmed
  };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt(n) {
    return D.roundDose(n).toLocaleString('en-US', { maximumFractionDigits: 3 });
  }

  function fmtRange(lo, hi) {
    return lo === hi ? fmt(lo) : fmt(lo) + '–' + fmt(hi);
  }

  // Strict number parse for text inputs: '' and '12abc' are NaN (parseFloat would accept '12abc').
  function num(id) {
    var t = $(id).value.trim();
    return t === '' ? NaN : Number(t);
  }

  function currentSpec() {
    return BY_ID[state.drugId][state.mode];
  }

  function needsWeight(spec) {
    if (!spec) return false;
    if (spec.type === 'weight' || spec.type === 'tiered') return true;
    if (spec.type === 'infusion') {
      return D.parseRateUnit(spec.rateUnit).perKg || !!(spec.bolus && spec.bolus.perKg);
    }
    return false;
  }

  function weightCheck() {
    if (state.pending) return { status: 'pending', kg: NaN, message: '', warnings: [] };
    return D.validateWeight($('weightInput').value, state.unit, state.mode);
  }

  // ───────── setup ─────────

  function initSelect() {
    var sel = $('drugSelect');
    var groups = {};
    DRUGS.forEach(function (d) {
      if (!groups[d.group]) {
        groups[d.group] = document.createElement('optgroup');
        groups[d.group].label = d.group;
        sel.appendChild(groups[d.group]);
      }
      var opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      groups[d.group].appendChild(opt);
    });
    sel.value = state.drugId;
  }

  // Re-populate infusion inputs whenever the drug or population changes.
  function resetInfusionInputs() {
    var spec = currentSpec();
    var box = $('infusionFields');
    if (!spec || spec.type !== 'infusion') { box.hidden = true; return; }
    box.hidden = false;
    $('rateInput').value = spec.start;
    $('rateUnitLabel').textContent = spec.rateUnit;
    var cs = $('concSelect');
    cs.innerHTML = '';
    spec.concs.forEach(function (c, i) {
      var o = document.createElement('option');
      o.value = String(i); o.textContent = c.label;
      cs.appendChild(o);
    });
    var custom = document.createElement('option');
    custom.value = 'custom'; custom.textContent = 'Custom concentration…';
    cs.appendChild(custom);
    $('customAmountUnit').textContent = customUnit(spec);
    $('customAmount').value = '';
    $('customVolume').value = '';
    $('customConc').hidden = true;
  }

  // Custom bags are entered in the same unit as the preset bags (mg for norepinephrine, mcg for octreotide),
  // so the number typed matches how the bag label reads.
  function customUnit(spec) {
    return spec.concs[0].unit;
  }

  function selectedConc(spec) {
    var v = $('concSelect').value;
    if (v !== 'custom') return spec.concs[Number(v)];
    return { amount: num('customAmount'), unit: customUnit(spec), volumeMl: num('customVolume'), custom: true };
  }

  // ───────── readout builders ─────────

  function big(value, unit) {
    return '<div class="dose-big mono">' + value + '<span class="dose-unit">' + esc(unit) + '</span></div>';
  }
  function desc(text) { return '<div class="dose-desc">' + esc(text) + '</div>'; }
  function warn(text) { return '<div class="cap-warning">⚠ ' + esc(text) + '</div>'; }
  // High-visibility alert for maximum-dose caps and likely unit mismatches.
  function alertBox(title, text) {
    return '<div class="dose-alert"><strong>' + esc(title) + '</strong> ' + esc(text) + '</div>';
  }
  function empty(text) { return '<div class="empty-state">' + esc(text) + '</div>'; }

  function volumeLine(spec, lo, hi) {
    if (!spec.perMl) return '';
    var vlo = D.volumeMl(lo, spec.perMl), vhi = D.volumeMl(hi, spec.perMl);
    return desc('= ' + fmtRange(vlo, vhi) + ' mL at ' + fmt(spec.perMl) + ' ' + spec.unit + '/mL');
  }

  function renderFixed(spec) {
    var lo = Array.isArray(spec.dose) ? spec.dose[0] : spec.dose;
    var hi = Array.isArray(spec.dose) ? spec.dose[1] : spec.dose;
    return big(fmtRange(lo, hi), spec.unit) + desc(spec.desc) + volumeLine(spec, lo, hi);
  }

  function renderWeight(spec, kg) {
    var r = D.weightDose(spec, kg);
    var range = Array.isArray(spec.perKg) ? spec.perKg : [spec.perKg, spec.perKg];
    var perKg = range[0] === range[1] ? range[0] : range.join('–');
    var html = '';
    if (r.capped) {
      html += alertBox('Max dose reached.', 'Calculated ' + fmtRange(range[0] * kg, range[1] * kg) + ' ' + spec.unit +
        ' exceeds the ' + fmt(spec.max) + ' ' + spec.unit + ' maximum — the dose shown is capped at the max.');
    }
    html += big(fmtRange(r.low, r.high), spec.unit) +
      desc(perKg + ' ' + spec.unit + '/kg × ' + fmt(kg) + ' kg — ' + spec.desc) +
      volumeLine(spec, r.low, r.high);
    if (spec.max != null && !r.capped) html += desc('Max single dose: ' + fmt(spec.max) + ' ' + spec.unit);
    if (r.floored) html += warn('Below the minimum dose — raised to ' + fmt(spec.min) + ' ' + spec.unit);
    (spec.extras || []).forEach(function (x) {
      var e = D.weightDose(x, kg);
      html += desc(x.label + ': ' + fmtRange(e.low, e.high) + ' ' + spec.unit);
      if (e.capped) html += alertBox('Max dose reached.', x.label + ' is capped at ' + fmt(x.max) + ' ' + spec.unit + '.');
    });
    return html;
  }

  function renderTiered(spec, kg) {
    var tier = D.tierFor(spec, kg);
    if (!tier) return empty('No dose listed for ' + fmt(kg) + ' kg in this reference — follow your protocol.');
    var band = tier.overKg != null ? '>' + tier.overKg + ' kg'
      : (tier.minKg != null ? tier.minKg : 0) + (tier.maxKg != null ? '–' + tier.maxKg : '+') + ' kg';
    return big(fmt(tier.dose), spec.unit) + desc(spec.desc + ' (weight band ' + band + ')');
  }

  function renderInfusion(spec, kg) {
    var u = D.parseRateUnit(spec.rateUnit);
    var dose = num('rateInput');
    var conc = selectedConc(spec);
    var html = '';

    if (!(conc.amount > 0 && conc.volumeMl > 0 && isFinite(conc.amount) && isFinite(conc.volumeMl))) {
      return empty('Enter the bag amount and volume as numbers greater than 0.');
    }
    if (u.perKg && !(kg > 0)) return empty('Enter a valid patient weight to calculate.');
    if ($('rateInput').value.trim() === '') return empty('Enter an ordered dose.');
    if (!(dose >= 0) || !isFinite(dose)) return empty('Ordered dose must be a number, 0 or more.');

    var ordered = dose;
    var capped = false;
    if (spec.capPerHr && u.perKg && u.per === 'hr' && dose * kg > spec.capPerHr) {
      dose = spec.capPerHr / kg;
      capped = true;
    }
    var check = D.checkOrderedDose(ordered, spec.range);
    var lo = spec.range[0], hi = spec.range[1];
    if (check === 'mismatch') {
      html += alertBox('Possible unit mismatch.', 'The ordered ' + fmt(ordered) + ' ' + spec.rateUnit + ' is 10× or more away from the ' +
        fmtRange(lo, hi) + ' ' + spec.rateUnit + ' reference range. Check mcg vs mg, per min vs per hr, and per kg.');
    }
    if (conc.custom && D.customConcMismatch(conc, spec.concs, u.amount)) {
      html += alertBox('Check the bag.', 'This custom concentration is 10× or more different from the standard bags — confirm the amount is in ' +
        conc.unit + ' and the volume in mL.');
    }
    if (capped) {
      html += alertBox('Max dose reached.', fmt(ordered) + ' ' + spec.rateUnit + ' × ' + fmt(kg) + ' kg exceeds the ' + fmt(spec.capPerHr) + ' ' +
        u.amount + '/hr maximum — the rate shown is at the cap.');
    }
    var rate = D.infusionRateMlHr(dose, spec.rateUnit, conc, kg);
    html += big(fmt(rate), 'mL/hr');
    html += desc(fmt(ordered) + ' ' + spec.rateUnit + (u.perKg ? ' × ' + fmt(kg) + ' kg' : '') +
      ' at ' + fmt(D.concPerMl(conc, u.amount)) + ' ' + u.amount + '/mL');
    html += desc(spec.desc);
    html += desc('Reference range: ' + fmtRange(lo, hi) + ' ' + spec.rateUnit);
    if (check === 'outside') html += warn('Ordered dose is outside the reference range — confirm the order and units');

    if (spec.bolus) {
      var b = spec.bolus;
      var bdose;
      if (b.perKg != null) {
        if (kg > 0) {
          var r = D.weightDose(b, kg);
          bdose = fmt(r.low) + ' ' + b.unit + (r.capped ? ' (MAX — capped at ' + fmt(b.max) + ')' : '');
        } else {
          bdose = b.perKg + ' ' + b.unit + '/kg';
        }
      } else {
        bdose = fmt(b.dose) + ' ' + b.unit;
      }
      html += desc('Bolus: ' + bdose + ' — ' + b.desc);
    }
    return html;
  }

  function renderReadout(w) {
    var drug = BY_ID[state.drugId];
    var spec = currentSpec();
    var body = $('readoutBody');

    if (!spec) {
      body.innerHTML = empty('No ' + (state.mode === 'adult' ? 'adult' : 'pediatric') +
        ' dosing is listed for ' + drug.name + ' in this reference.');
      return;
    }
    if (spec.type === 'fixed') { body.innerHTML = renderFixed(spec); return; }
    if (spec.type === 'text') { body.innerHTML = '<div class="dose-text">' + esc(spec.text) + '</div>' + desc(spec.desc); return; }

    if (w.status === 'pending') { body.innerHTML = empty('Answer “Is this still the same patient?” above to see a dose.'); return; }
    var kg = w.status === 'ok' ? w.kg : NaN;
    var checks = w.warnings.map(warn).join('');
    if (spec.type === 'infusion') { body.innerHTML = renderInfusion(spec, kg) + checks; return; }
    if (w.status === 'invalid' || w.status === 'implausible') { body.innerHTML = empty('Fix the patient weight above to see a dose.'); return; }
    if (!(kg > 0)) { body.innerHTML = empty('Enter a patient weight to calculate.'); return; }
    body.innerHTML = (spec.type === 'tiered' ? renderTiered(spec, kg) : renderWeight(spec, kg)) + checks;
  }

  var NOW_YEAR = new Date().getFullYear();

  function renderNotes() {
    var drug = BY_ID[state.drugId];
    var spec = currentSpec();
    $('concNote').textContent = 'Concentration: ' + ((spec && spec.conc) || drug.conc);
    var html = esc(drug.note);
    if (drug.warnings && drug.warnings.length) {
      html += '<ul class="warn-list">' +
        drug.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>';
    }
    if (drug.source) {
      var years = C.sourceYears(drug, NOW_YEAR);
      html += '<div class="src-line">Reference: ' + esc(drug.source) + '</div>';
      html += years.source.length
        ? '<div class="src-line src-year">Guideline year: ' + years.source.join(', ') + '</div>'
        : '<div class="src-line src-year src-unknown">Guideline year: not recorded for this entry — confirm against the current edition.</div>';
      if (years.checked.length) html += '<div class="src-line">Citation check quotes sources dated ' + years.checked.join(', ') + '.</div>';
    }
    if (drug.sourceNote) html += '<div class="src-line">Source check: ' + esc(drug.sourceNote) + '</div>';
    if (drug.review) html += '<div class="src-line review-flag">⚑ Flagged for clinical review: ' + esc(drug.review) + '</div>';
    $('noteBody').innerHTML = html;
  }

  function renderWeightField(w) {
    var show = needsWeight(currentSpec());
    $('weightField').hidden = !show;
    var input = $('weightInput');
    var hasValue = input.value.trim() !== '';
    $('clearWeightBtn').hidden = !hasValue && !state.pending;

    var check = $('patientCheck');
    check.hidden = !state.pending;
    input.disabled = !!state.pending;
    if (state.pending) {
      var p = state.pending;
      $('patientCheckText').textContent = 'A weight of ' + p.value + ' ' + p.unit + ' (' + (p.mode === 'peds' ? 'pediatric' : 'adult') +
        ') was entered ' + P.formatAge(p.ageMs) + '. Use it only if this is the same patient.';
    }

    var status = '';
    if (w.status === 'ok') {
      var other = state.unit === 'lb' ? fmt(w.kg) + ' kg' : fmt(D.kgToLb(w.kg)) + ' lb';
      status = '= ' + other;
      var mem = prefs.recallPatient();
      if (mem && mem.value === input.value.trim()) status += ' · remembered on this device (' + P.formatAge(mem.ageMs) + ')';
    }
    $('weightStatus').textContent = status;

    var msg = $('weightMsg');
    msg.textContent = w.message;
    msg.className = 'weight-msg' + (w.message ? ' is-error' : '');
    input.setAttribute('aria-invalid', w.status === 'invalid' || w.status === 'implausible' ? 'true' : 'false');
  }

  function renderFav() {
    var on = prefs.isFavorite(state.drugId);
    var btn = $('favBtn');
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.textContent = on ? '★' : '☆';
    var label = on ? 'Remove from favorites' : 'Add to favorites';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }

  function chip(id) {
    var d = BY_ID[id];
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = d.name;
    b.title = d.name;
    if (id === state.drugId) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', function () { selectDrug(id); });
    return b;
  }

  function renderChips() {
    var favs = prefs.getFavorites();
    var recents = prefs.getRecents().filter(function (id) { return favs.indexOf(id) === -1; });
    [['favRow', 'favChips', favs], ['recentRow', 'recentChips', recents]].forEach(function (row) {
      var box = $(row[1]);
      box.innerHTML = '';
      row[2].forEach(function (id) { box.appendChild(chip(id)); });
      $(row[0]).hidden = !row[2].length;
    });
  }

  function renderStamp() {
    var updated = new Date(C.DATA_UPDATED + 'T12:00:00');
    var when = isNaN(updated) ? C.DATA_UPDATED : updated.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    var review = C.REVIEW.status === 'reviewed'
      ? 'Clinically reviewed ' + esc(C.REVIEW.date) + (C.REVIEW.by ? ' by ' + esc(C.REVIEW.by) : '')
      : '<span class="stamp-pending">Clinical review: pending</span> — ' + esc(C.REVIEW.note || '');
    $('contentStamp').innerHTML =
      '<div>Drug reference <span class="mono">v' + esc(C.CONTENT_VERSION) + '</span> · data last updated <time datetime="' +
      esc(C.DATA_UPDATED) + '">' + esc(when) + '</time></div><div>' + review + '</div>' +
      '<div>Each drug lists its source and guideline year under “Clinical note”.</div>';
  }

  function render() {
    var drug = BY_ID[state.drugId];
    [['modeAdult', 'adult'], ['modePeds', 'peds']].forEach(function (m) {
      var btn = $(m[0]);
      btn.classList.toggle('active', state.mode === m[1]);
      btn.setAttribute('aria-pressed', state.mode === m[1] ? 'true' : 'false');
      btn.classList.toggle('unavailable', !drug[m[1]]);
    });
    $('unitKg').classList.toggle('active', state.unit === 'kg');
    $('unitLb').classList.toggle('active', state.unit === 'lb');
    $('unitKg').setAttribute('aria-pressed', state.unit === 'kg' ? 'true' : 'false');
    $('unitLb').setAttribute('aria-pressed', state.unit === 'lb' ? 'true' : 'false');
    var w = weightCheck();
    renderWeightField(w);
    renderFav();
    renderNotes();
    renderReadout(w);
  }

  // ───────── patient weight memory ─────────

  function saveWeight() {
    var w = weightCheck();
    if (w.status === 'ok') prefs.rememberPatient($('weightInput').value, state.unit, state.mode);
    else if (w.status !== 'pending') prefs.forgetPatient();
  }

  // Loads the remembered patient. A fresh one fills the weight; an old one asks first.
  function applyRemembered() {
    var p = prefs.recallPatient();
    if (!p) {
      state.pending = null;
      $('weightInput').value = '';
      return;
    }
    state.unit = p.unit;
    state.mode = p.mode;
    if (p.needsConfirm) {
      state.pending = p;
      $('weightInput').value = '';
    } else {
      state.pending = null;
      $('weightInput').value = p.value;
    }
  }

  // While the page stays open, an idle weight goes stale too.
  function checkIdle() {
    if (state.pending || weightCheck().status !== 'ok') return;
    var p = prefs.recallPatient();
    if (!p || p.needsConfirm) { applyRemembered(); render(); }
  }

  function touch() {
    if (!state.pending && weightCheck().status === 'ok') prefs.touchPatient();
  }

  // ───────── actions ─────────

  function selectDrug(id) {
    if (!BY_ID[id]) return;
    state.drugId = id;
    $('drugSelect').value = id;
    var drug = BY_ID[id];
    // Jump to the population that actually has dosing when only one exists.
    if (!drug[state.mode]) state.mode = drug.adult ? 'adult' : 'peds';
    prefs.pushRecent(id);
    touch();
    resetInfusionInputs();
    renderChips();
    render();
  }

  function setMode(m) {
    state.mode = m;
    saveWeight();
    resetInfusionInputs();
    render();
  }

  // The toggle says which unit the typed number is in; the "= … kg/lb" line shows how it was read.
  function setUnit(u) {
    state.unit = u;
    prefs.setUnit(u);
    saveWeight();
    render();
  }

  function clearWeight() {
    prefs.forgetPatient();
    state.pending = null;
    var input = $('weightInput');
    input.value = '';
    render();
    input.focus();
  }

  // ───────── search ─────────

  var search = { results: [], active: -1 };

  function closeSearch() {
    $('searchResults').hidden = true;
    $('drugSearch').setAttribute('aria-expanded', 'false');
    $('drugSearch').removeAttribute('aria-activedescendant');
    search.active = -1;
  }

  function renderSearch() {
    var q = $('drugSearch').value;
    var list = $('searchResults');
    search.results = P.searchDrugs(DRUGS, q, 8);
    list.innerHTML = '';
    if (!q.trim()) { closeSearch(); return; }
    if (!search.results.length) {
      var none = document.createElement('li');
      none.className = 'search-empty';
      none.textContent = 'No medication matches “' + q.trim() + '”.';
      list.appendChild(none);
    }
    search.results.forEach(function (d, i) {
      var li = document.createElement('li');
      li.id = 'search-opt-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === search.active ? 'true' : 'false');
      li.innerHTML = '<span class="search-name">' + esc(d.name) + '</span><span class="search-group">' + esc(d.group) + '</span>';
      // mousedown keeps focus in the input so blur doesn't close the list before the click lands.
      li.addEventListener('mousedown', function (e) { e.preventDefault(); });
      li.addEventListener('click', function () { pickSearch(i); });
      list.appendChild(li);
    });
    list.hidden = false;
    $('drugSearch').setAttribute('aria-expanded', 'true');
    if (search.active >= 0) $('drugSearch').setAttribute('aria-activedescendant', 'search-opt-' + search.active);
    else $('drugSearch').removeAttribute('aria-activedescendant');
  }

  function pickSearch(i) {
    var d = search.results[i];
    if (!d) return;
    $('drugSearch').value = '';
    closeSearch();
    selectDrug(d.id);
  }

  function onSearchKey(e) {
    var n = search.results.length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); search.active = (search.active + 1) % n; renderSearch(); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); search.active = (search.active - 1 + n) % n; renderSearch(); }
    else if (e.key === 'Enter') { e.preventDefault(); pickSearch(search.active >= 0 ? search.active : 0); }
    else if (e.key === 'Escape') { $('drugSearch').value = ''; closeSearch(); }
  }

  // ───────── vitals ─────────

  function toggleVitals() {
    var wrap = $('vitalsWrap');
    var open = wrap.hidden;
    wrap.hidden = !open;
    $('vitalsToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    $('vitalsChevron').classList.toggle('open', open);
    if (open && wrap.innerHTML === '') {
      var rows = VITALS_REF.map(function (v) {
        return '<tr><td>' + v.age + '</td><td class="num mono v-hr">' + v.hr +
          '</td><td class="num mono v-rr">' + v.rr + '</td><td class="num mono v-sbp">' + v.sbp + '</td></tr>';
      }).join('');
      wrap.innerHTML = '<table><thead><tr><th>Age</th><th class="num">HR</th><th class="num">RR</th><th class="num">SBP</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }
  }

  // ───────── wiring ─────────

  $('drugSelect').addEventListener('change', function () { selectDrug(this.value); });
  $('favBtn').addEventListener('click', function () { prefs.toggleFavorite(state.drugId); renderChips(); renderFav(); });
  $('modeAdult').addEventListener('click', function () { setMode('adult'); });
  $('modePeds').addEventListener('click', function () { setMode('peds'); });
  $('unitKg').addEventListener('click', function () { setUnit('kg'); });
  $('unitLb').addEventListener('click', function () { setUnit('lb'); });
  $('weightInput').addEventListener('input', function () { saveWeight(); render(); });
  $('clearWeightBtn').addEventListener('click', clearWeight);
  $('samePatientBtn').addEventListener('click', function () {
    prefs.touchPatient();
    applyRemembered();
    render();
    $('weightInput').focus();
  });
  $('newPatientBtn').addEventListener('click', clearWeight);
  ['rateInput', 'customAmount', 'customVolume'].forEach(function (id) { $(id).addEventListener('input', render); });
  $('concSelect').addEventListener('change', function () {
    $('customConc').hidden = this.value !== 'custom';
    render();
  });
  $('drugSearch').addEventListener('input', function () { search.active = -1; renderSearch(); });
  $('drugSearch').addEventListener('keydown', onSearchKey);
  $('drugSearch').addEventListener('blur', closeSearch);
  $('vitalsToggle').addEventListener('click', toggleVitals);

  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkIdle(); });
  setInterval(checkIdle, 30 * 1000);
  // "New patient" or a new weight in another open tab applies here too.
  window.addEventListener('storage', function (e) {
    if (e.key === P.KEYS.patient || e.key === null) { applyRemembered(); render(); }
    if (e.key === P.KEYS.favorites || e.key === P.KEYS.recents) { renderChips(); renderFav(); }
  });

  initSelect();
  applyRemembered();
  var drug0 = BY_ID[state.drugId];
  if (!drug0[state.mode]) state.mode = drug0.adult ? 'adult' : 'peds';
  resetInfusionInputs();
  renderChips();
  renderStamp();
  render();
})();
