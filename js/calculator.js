/*
 * ER Dosing Reference — page controller for calculator.html.
 * Data: js/drugs.js (window.PulseDrugs). Math: js/dosing.js (window.PulseDosing).
 */
(function () {
  'use strict';

  var D = window.PulseDosing;
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

  var state = { drugId: DRUGS[0].id, mode: 'adult', unit: 'kg' };

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

  function weightKg() {
    return D.toKg($('weightInput').value, state.unit);
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
    if (!spec || spec.type !== 'infusion') { box.style.display = 'none'; return; }
    box.style.display = 'block';
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
    var amountUnit = D.parseRateUnit(spec.rateUnit).amount;
    $('customAmountUnit').textContent = amountUnit === 'mcg' ? 'mg' : amountUnit;
    $('customAmount').value = '';
    $('customVolume').value = '';
    $('customConc').style.display = 'none';
  }

  function selectedConc(spec) {
    var v = $('concSelect').value;
    if (v !== 'custom') return spec.concs[Number(v)];
    var amountUnit = D.parseRateUnit(spec.rateUnit).amount;
    return {
      amount: parseFloat($('customAmount').value),
      unit: amountUnit === 'mcg' ? 'mg' : amountUnit,
      volumeMl: parseFloat($('customVolume').value)
    };
  }

  // ───────── readout builders ─────────

  function big(value, unit) {
    return '<div class="dose-big mono">' + value + '<span class="dose-unit">' + esc(unit) + '</span></div>';
  }
  function desc(text) { return '<div class="dose-desc">' + esc(text) + '</div>'; }
  function warn(text) { return '<div class="cap-warning">⚠ ' + esc(text) + '</div>'; }
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
    var perKg = Array.isArray(spec.perKg) ? spec.perKg.join('–') : spec.perKg;
    var html = big(fmtRange(r.low, r.high), spec.unit) +
      desc(perKg + ' ' + spec.unit + '/kg × ' + fmt(kg) + ' kg — ' + spec.desc) +
      volumeLine(spec, r.low, r.high);
    if (r.capped) html += warn('Weight-based calc exceeded the max — capped at ' + fmt(spec.max) + ' ' + spec.unit);
    if (r.floored) html += warn('Below the minimum dose — raised to ' + fmt(spec.min) + ' ' + spec.unit);
    (spec.extras || []).forEach(function (x) {
      var e = D.weightDose(x, kg);
      html += desc(x.label + ': ' + fmtRange(e.low, e.high) + ' ' + spec.unit + (e.capped ? ' (capped)' : ''));
    });
    return html;
  }

  function renderTiered(spec, kg) {
    var tier = spec.tiers.filter(function (t) {
      return (t.minKg == null || kg >= t.minKg) && (t.maxKg == null || kg < t.maxKg);
    })[0];
    if (!tier) return empty('No dose listed for ' + fmt(kg) + ' kg in this reference — follow your protocol.');
    var band = (tier.minKg != null ? tier.minKg : 0) + (tier.maxKg != null ? '–' + tier.maxKg : '+') + ' kg';
    return big(fmt(tier.dose), spec.unit) + desc(spec.desc + ' (weight band ' + band + ')');
  }

  function renderInfusion(spec, kg) {
    var u = D.parseRateUnit(spec.rateUnit);
    var dose = parseFloat($('rateInput').value);
    var conc = selectedConc(spec);
    var html = '';

    if (!(conc.amount > 0 && conc.volumeMl > 0)) return empty('Enter the bag amount and volume.');
    if (u.perKg && !(kg > 0)) return empty('Enter a patient weight to calculate.');
    if (!(dose >= 0)) return empty('Enter an ordered dose.');

    var ordered = dose;
    var capped = false;
    if (spec.capPerHr && u.perKg && u.per === 'hr' && dose * kg > spec.capPerHr) {
      dose = spec.capPerHr / kg;
      capped = true;
    }
    var rate = D.infusionRateMlHr(dose, spec.rateUnit, conc, kg);
    html += big(fmt(rate), 'mL/hr');
    html += desc(fmt(ordered) + ' ' + spec.rateUnit + (u.perKg ? ' × ' + fmt(kg) + ' kg' : '') +
      ' at ' + fmt(D.concPerMl(conc, u.amount)) + ' ' + u.amount + '/mL');
    html += desc(spec.desc);
    if (capped) html += warn('Exceeds max ' + fmt(spec.capPerHr) + ' ' + u.amount + '/hr — rate shown is at the cap');
    var lo = spec.range[0], hi = spec.range[1];
    html += desc('Reference range: ' + fmtRange(lo, hi) + ' ' + spec.rateUnit);
    if (ordered < lo || ordered > hi) html += warn('Ordered dose is outside the reference range — confirm the order and units');

    if (spec.bolus) {
      var b = spec.bolus;
      var bdose;
      if (b.perKg != null) {
        if (kg > 0) {
          var r = D.weightDose(b, kg);
          bdose = fmt(r.low) + ' ' + b.unit + (r.capped ? ' (capped at ' + fmt(b.max) + ')' : '');
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

  function renderReadout() {
    var drug = BY_ID[state.drugId];
    var spec = currentSpec();
    var body = $('readoutBody');

    if (!spec) {
      body.innerHTML = empty('No ' + (state.mode === 'adult' ? 'adult' : 'pediatric') +
        ' dosing is listed for ' + drug.name + ' in this reference.');
      return;
    }
    if (spec.type === 'fixed') { body.innerHTML = renderFixed(spec); return; }
    if (spec.type === 'text') { body.innerHTML = '<div class="dose-desc" style="color:#E8F0F2;font-size:15px;">' + esc(spec.text) + '</div>' + desc(spec.desc); return; }

    var kg = weightKg();
    if (spec.type === 'infusion') { body.innerHTML = renderInfusion(spec, kg); return; }
    if (!(kg > 0)) { body.innerHTML = empty('Enter a patient weight to calculate.'); return; }
    body.innerHTML = spec.type === 'tiered' ? renderTiered(spec, kg) : renderWeight(spec, kg);
  }

  function renderNotes() {
    var drug = BY_ID[state.drugId];
    var spec = currentSpec();
    $('concNote').textContent = 'Concentration: ' + ((spec && spec.conc) || drug.conc);
    var html = esc(drug.note);
    if (drug.warnings && drug.warnings.length) {
      html += '<ul style="margin:10px 0 0;padding-left:18px;color:#F2A93B;">' +
        drug.warnings.map(function (w) { return '<li style="margin-bottom:4px;">' + esc(w) + '</li>'; }).join('') + '</ul>';
    }
    if (drug.source) html += '<div style="margin-top:10px;font-size:11px;">Reference: ' + esc(drug.source) + '</div>';
    if (drug.review) html += '<div style="margin-top:6px;font-size:11px;color:#F2A93B;">⚑ Flagged for clinical review: ' + esc(drug.review) + '</div>';
    $('noteBody').innerHTML = html;
  }

  function render() {
    var drug = BY_ID[state.drugId];
    $('modeAdult').classList.toggle('active', state.mode === 'adult');
    $('modePeds').classList.toggle('active', state.mode === 'peds');
    $('modeAdult').style.opacity = drug.adult ? '' : '0.45';
    $('modePeds').style.opacity = drug.peds ? '' : '0.45';
    $('weightField').style.display = needsWeight(currentSpec()) ? 'block' : 'none';
    renderNotes();
    renderReadout();
  }

  // ───────── handlers (called from inline attributes in calculator.html) ─────────

  window.onDrugChange = function () {
    state.drugId = $('drugSelect').value;
    var drug = BY_ID[state.drugId];
    // Jump to the population that actually has dosing when only one exists.
    if (!drug[state.mode]) state.mode = drug.adult ? 'adult' : 'peds';
    resetInfusionInputs();
    render();
  };

  window.setMode = function (m) {
    state.mode = m;
    resetInfusionInputs();
    render();
  };

  window.setUnit = function (u) {
    state.unit = u;
    $('unitKg').classList.toggle('active', u === 'kg');
    $('unitLb').classList.toggle('active', u === 'lb');
    render();
  };

  window.onConcChange = function () {
    $('customConc').style.display = $('concSelect').value === 'custom' ? 'flex' : 'none';
    render();
  };

  window.render = render;

  window.toggleVitals = function () {
    var wrap = $('vitalsWrap');
    var chevron = $('vitalsChevron');
    var isOpen = wrap.style.display !== 'none';
    wrap.style.display = isOpen ? 'none' : 'block';
    chevron.classList.toggle('open', !isOpen);
    if (!isOpen && wrap.innerHTML === '') {
      var rows = VITALS_REF.map(function (v) {
        return '<tr><td>' + v.age + '</td><td class="num mono" style="color:#35D07F;">' + v.hr +
          '</td><td class="num mono" style="color:#2FB8C6;">' + v.rr +
          '</td><td class="num mono" style="color:#F2A93B;">' + v.sbp + '</td></tr>';
      }).join('');
      wrap.innerHTML = '<table><thead><tr><th>Age</th><th class="num">HR</th><th class="num">RR</th><th class="num">SBP</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }
  };

  initSelect();
  resetInfusionInputs();
  render();
})();
