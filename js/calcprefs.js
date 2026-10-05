/*
 * Pulse-Protocol calculator memory: favorites, recently used drugs, kg/lb preference and the
 * remembered patient weight, plus drug search. No DOM, so it can be unit-tested in Node:
 *   node --test tests/calcprefs.test.js
 * In the browser it is exposed as window.PulseCalcPrefs.
 *
 * Everything lives in localStorage on this device only. Storage can be missing or throw (private
 * mode, blocked site data): every read/write is guarded and the calculator still works without it.
 */
(function (root) {
  'use strict';

  var KEYS = {
    favorites: 'pulse-calc-favorites',
    recents: 'pulse-calc-recents',
    unit: 'pulse-calc-unit',
    patient: 'pulse-calc-patient'
  };
  var MAX_RECENTS = 5;
  // A remembered weight older than this (since it was last entered, confirmed or used) is not used
  // until the user answers "is this still the same patient?".
  var CONFIRM_AFTER_MS = 15 * 60 * 1000;
  // Older than this it is discarded outright — no prompt, start fresh.
  var FORGET_AFTER_MS = 12 * 60 * 60 * 1000;

  function memoryStorage() {
    var data = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; }
    };
  }

  /*
   * opts: { storage?, now?: () => ms, knownIds?: string[] }
   * knownIds drops favorites/recents for drugs that no longer exist in the data.
   */
  function createPrefs(opts) {
    opts = opts || {};
    var storage = opts.storage || memoryStorage();
    var now = opts.now || function () { return Date.now(); };
    var known = null;
    if (opts.knownIds) {
      known = {};
      opts.knownIds.forEach(function (id) { known[id] = true; });
    }

    function read(key) {
      try {
        var raw = storage.getItem(key);
        return raw == null ? null : JSON.parse(raw);
      } catch (e) { return null; }
    }
    function write(key, value) {
      try {
        if (value == null) storage.removeItem(key);
        else storage.setItem(key, JSON.stringify(value));
      } catch (e) { /* storage full or blocked: keep working without memory */ }
    }
    function idList(key) {
      var v = read(key);
      if (!Array.isArray(v)) return [];
      var seen = {};
      return v.filter(function (id) {
        if (typeof id !== 'string' || seen[id] || (known && !known[id])) return false;
        seen[id] = true;
        return true;
      });
    }

    // ── favorites ──
    function getFavorites() { return idList(KEYS.favorites); }
    function isFavorite(id) { return getFavorites().indexOf(id) !== -1; }
    function toggleFavorite(id) {
      var list = getFavorites();
      var i = list.indexOf(id);
      if (i === -1) list.push(id); else list.splice(i, 1);
      write(KEYS.favorites, list);
      return i === -1;
    }

    // ── recently used (most recent first) ──
    function getRecents() { return idList(KEYS.recents); }
    function pushRecent(id) {
      if (known && !known[id]) return getRecents();
      var list = getRecents().filter(function (x) { return x !== id; });
      list.unshift(id);
      list = list.slice(0, MAX_RECENTS);
      write(KEYS.recents, list);
      return list;
    }

    // ── weight unit preference ──
    function getUnit() { return read(KEYS.unit) === 'lb' ? 'lb' : 'kg'; }
    function setUnit(u) { write(KEYS.unit, u === 'lb' ? 'lb' : 'kg'); }

    // ── remembered patient (weight as typed, its unit, adult/peds) ──
    function rememberPatient(value, unit, mode) {
      var text = value == null ? '' : String(value).trim();
      if (text === '') { write(KEYS.patient, null); return null; }
      var p = { value: text, unit: unit === 'lb' ? 'lb' : 'kg', mode: mode === 'peds' ? 'peds' : 'adult', at: now() };
      write(KEYS.patient, p);
      return p;
    }
    // Marks the remembered patient as still current (user confirmed, or is actively using it).
    function touchPatient() {
      var p = read(KEYS.patient);
      if (!p || typeof p.value !== 'string') return null;
      p.at = now();
      write(KEYS.patient, p);
      return p;
    }
    function forgetPatient() { write(KEYS.patient, null); }
    /*
     * Returns null, or { value, unit, mode, at, ageMs, needsConfirm }.
     * Entries that are malformed, from the future, or older than FORGET_AFTER_MS are deleted.
     */
    function recallPatient() {
      var p = read(KEYS.patient);
      if (!p) return null;
      var ok = typeof p.value === 'string' && p.value.trim() !== '' && isFinite(Number(p.value)) &&
        (p.unit === 'kg' || p.unit === 'lb') && typeof p.at === 'number' && isFinite(p.at);
      var age = ok ? now() - p.at : NaN;
      if (!ok || age < 0 || age > FORGET_AFTER_MS) { forgetPatient(); return null; }
      return {
        value: p.value, unit: p.unit, mode: p.mode === 'peds' ? 'peds' : 'adult', at: p.at,
        ageMs: age, needsConfirm: age > CONFIRM_AFTER_MS
      };
    }

    return {
      getFavorites: getFavorites, isFavorite: isFavorite, toggleFavorite: toggleFavorite,
      getRecents: getRecents, pushRecent: pushRecent,
      getUnit: getUnit, setUnit: setUnit,
      rememberPatient: rememberPatient, touchPatient: touchPatient,
      forgetPatient: forgetPatient, recallPatient: recallPatient
    };
  }

  // "3 min ago", "2 hr 5 min ago" — for the remembered-weight status line.
  function formatAge(ms) {
    var min = Math.max(0, Math.floor(ms / 60000));
    if (min < 1) return 'just now';
    if (min < 60) return min + ' min ago';
    var h = Math.floor(min / 60), m = min % 60;
    return h + ' hr' + (m ? ' ' + m + ' min' : '') + ' ago';
  }

  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /*
   * Drug search: every word of the query must start a word in the drug's name, group or id
   * ("epi ana" → Epinephrine — Anaphylaxis). Matches at the start of the name rank first.
   */
  function searchDrugs(drugs, query, limit) {
    var words = norm(query).split(' ').filter(Boolean);
    if (!words.length) return [];
    var hits = [];
    drugs.forEach(function (d, index) {
      var name = norm(d.name);
      var hay = ' ' + name + ' ' + norm(d.group) + ' ' + norm(d.id) + ' ';
      for (var i = 0; i < words.length; i++) {
        if (hay.indexOf(' ' + words[i]) === -1) return;
      }
      hits.push({ drug: d, rank: name.indexOf(words[0]) === 0 ? 0 : 1, index: index });
    });
    hits.sort(function (a, b) { return a.rank - b.rank || a.index - b.index; });
    return hits.slice(0, limit || 8).map(function (h) { return h.drug; });
  }

  var api = {
    createPrefs: createPrefs,
    formatAge: formatAge,
    searchDrugs: searchDrugs,
    KEYS: KEYS,
    MAX_RECENTS: MAX_RECENTS,
    CONFIRM_AFTER_MS: CONFIRM_AFTER_MS,
    FORGET_AFTER_MS: FORGET_AFTER_MS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PulseCalcPrefs = api;
})(typeof window !== 'undefined' ? window : this);
