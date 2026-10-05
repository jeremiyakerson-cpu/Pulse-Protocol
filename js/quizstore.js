/*
 * Pulse-Protocol quiz progress — pure functions over the saved progress object (no DOM, no storage).
 *   node --test tests/quizstore.test.js
 * In the browser they are exposed as window.PulseQuizStore; quiz.js does the actual localStorage I/O.
 * Depends on js/srs.js (window.PulseSRS) for the per-question scheduler records.
 *
 * Schema 2 (localStorage key pulseProtocol.quiz.v2):
 *   { schema: 2, missed: [id], history: [{ t, score, total, review, mode }], cats: [cat] | null, length: n,
 *     mode: 'study' | 'exam' | 'adaptive', examSecs: n, stats: { [cat]: { seen, correct } },
 *     items: { [id]: SRS item (see js/srs.js) }, perf: [0|1] (last answers, oldest first),
 *     streak: { last: day number | null, count, best }, askConf: bool, sessionSize: n }
 * Schema 1 (key pulseProtocol.quiz.v1) had no `schema` field and stopped at `stats`. migrate() upgrades it:
 * every missed id becomes a lapsed item that is due today, and the day streak is rebuilt from history.
 * The v1 key is left in place, untouched, as a fallback.
 */
(function (root) {
  'use strict';

  var SRS = typeof module !== 'undefined' && module.exports ? require('./srs.js') : root.PulseSRS;

  var SCHEMA = 2;
  var KEYS = { 1: 'pulseProtocol.quiz.v1', 2: 'pulseProtocol.quiz.v2' };
  var MODES = ['study', 'exam', 'adaptive'];
  var EXAM_SECS = [45, 60, 90];   // seconds allowed per question in exam mode
  var SESSION_SIZES = [10, 20, 30]; // adaptive session lengths
  var HISTORY_MAX = 20;
  var EXPORT_KIND = 'pulse-protocol/quiz-progress';

  function isCount(n) { return typeof n === 'number' && isFinite(n) && n >= 0 && Math.floor(n) === n; }
  function isNum(n) { return typeof n === 'number' && isFinite(n); }
  function isInt(n) { return isNum(n) && Math.floor(n) === n; }

  // A scheduler record from storage, or null if it is not trustworthy.
  function cleanItem(it) {
    if (!it || typeof it !== 'object') return null;
    if (!isCount(it.n) || it.n < 1 || !isCount(it.c) || it.c > it.n) return null;
    if (!isInt(it.due) || !isNum(it.last) || it.last <= 0) return null;
    return {
      n: it.n, c: it.c,
      ema: isNum(it.ema) && it.ema >= 0 && it.ema <= 1 ? it.ema : it.c / it.n,
      ef: isNum(it.ef) ? Math.min(SRS.EF_MAX, Math.max(SRS.EF_MIN, it.ef)) : SRS.EF_START,
      iv: isCount(it.iv) ? it.iv : 0,
      reps: isCount(it.reps) ? it.reps : 0,
      due: it.due, last: it.last,
      lapses: isCount(it.lapses) ? it.lapses : 0,
      conf: it.conf === 1 || it.conf === 2 || it.conf === 3 ? it.conf : null
    };
  }

  function cleanStreak(st) {
    if (st && (st.last === null || isInt(st.last)) && isCount(st.count) && isCount(st.best) && st.count <= st.best) {
      return { last: st.last, count: st.last === null ? 0 : st.count, best: st.best };
    }
    return { last: null, count: 0, best: 0 };
  }

  // Upgrade any older stored shape to the current schema (before normalize() validates it).
  // `now` is used for the due date of migrated missed questions when history has no timestamp.
  function migrate(raw, now) {
    var s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    if (s.schema === SCHEMA) return s;
    var out = {};
    Object.keys(s).forEach(function (k) { out[k] = s[k]; });
    out.schema = SCHEMA;
    var times = (Array.isArray(s.history) ? s.history : [])
      .map(function (h) { return h && h.t; })
      .filter(function (t) { return isNum(t) && t > 0; })
      .sort(function (a, b) { return a - b; });
    var lastT = times.length ? times[times.length - 1] : now;
    out.items = {};
    (Array.isArray(s.missed) ? s.missed : []).forEach(function (id) {
      if (typeof id !== 'string' || out.items[id]) return;
      // Seen once, answered wrong: a lapsed SM-2 record, due on the day it was missed (so due now).
      out.items[id] = SRS.review(null, false, null, lastT);
    });
    var streak = null;
    times.forEach(function (t) { streak = SRS.bumpStreak(streak, t); });
    out.streak = streak || { last: null, count: 0, best: 0 };
    out.perf = [];
    return out;
  }

  // Repair whatever came out of storage: drop unknown ids/categories and bad numbers, fill defaults.
  function normalize(raw, validIds, catKeys, now) {
    var s = migrate(raw, now || Date.now());
    var ids = {};
    (validIds || []).forEach(function (id) { ids[id] = true; });
    var out = {
      schema: SCHEMA,
      missed: Array.isArray(s.missed) ? s.missed.filter(function (id, i, a) { return ids[id] && a.indexOf(id) === i; }) : [],
      history: Array.isArray(s.history)
        ? s.history.filter(function (h) { return h && isCount(h.score) && isCount(h.total) && h.total > 0 && h.score <= h.total; }).slice(-HISTORY_MAX)
        : [],
      cats: Array.isArray(s.cats) ? s.cats.filter(function (c) { return catKeys.indexOf(c) !== -1; }) : null,
      length: s.length,
      mode: MODES.indexOf(s.mode) !== -1 ? s.mode : 'study',
      examSecs: EXAM_SECS.indexOf(s.examSecs) !== -1 ? s.examSecs : 60,
      stats: {},
      items: {},
      perf: Array.isArray(s.perf) ? s.perf.filter(function (b) { return b === 0 || b === 1; }).slice(-SRS.PERF_MAX) : [],
      streak: cleanStreak(s.streak),
      askConf: s.askConf !== false,
      sessionSize: SESSION_SIZES.indexOf(s.sessionSize) !== -1 ? s.sessionSize : 20
    };
    if (s.items && typeof s.items === 'object') {
      Object.keys(s.items).forEach(function (id) {
        var it = ids[id] ? cleanItem(s.items[id]) : null;
        if (it) out.items[id] = it;
      });
    }
    catKeys.forEach(function (c) {
      var st = s.stats && s.stats[c];
      if (st && isCount(st.seen) && isCount(st.correct) && st.correct <= st.seen) out.stats[c] = { seen: st.seen, correct: st.correct };
    });
    return out;
  }

  // One answered question: update lifetime per-category stats, the missed list (a correct answer clears it),
  // the question's scheduler record, recent performance and the day streak. conf: 1–3 or null (not rated).
  function recordAnswer(store, id, cat, correct, conf, now) {
    var t = now || Date.now();
    store.items[id] = SRS.review(store.items[id], correct, conf, t);
    store.perf.push(correct ? 1 : 0);
    if (store.perf.length > SRS.PERF_MAX) store.perf = store.perf.slice(-SRS.PERF_MAX);
    store.streak = SRS.bumpStreak(store.streak, t);
    var st = store.stats[cat] || (store.stats[cat] = { seen: 0, correct: 0 });
    st.seen++;
    if (correct) st.correct++;
    var m = store.missed.indexOf(id);
    if (!correct && m === -1) store.missed.push(id);
    if (correct && m !== -1) store.missed.splice(m, 1);
    return store;
  }

  function recordRun(store, run) {
    store.history.push(run);
    if (store.history.length > HISTORY_MAX) store.history = store.history.slice(-HISTORY_MAX);
    return store;
  }

  // Per-category summary rows for display, in category order; pct is null when nothing has been answered.
  function categorySummary(store, catKeys) {
    return catKeys.map(function (c) {
      var st = store.stats[c] || { seen: 0, correct: 0 };
      return { cat: c, seen: st.seen, correct: st.correct, pct: st.seen ? Math.round((st.correct / st.seen) * 100) : null };
    });
  }

  // Exam time budget and a mm:ss formatter for the countdown.
  function examBudgetMs(nQuestions, secsPerQuestion) { return nQuestions * secsPerQuestion * 1000; }
  function formatClock(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    return m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  // Read the newest stored schema from a key → JSON-string lookup (a localStorage.getItem wrapper).
  // Returns { raw, from } where `from` is the schema it was found under (0 = nothing stored).
  function readStored(get) {
    for (var v = SCHEMA; v >= 1; v--) {
      var txt = get(KEYS[v]);
      if (txt === null || txt === undefined) continue;
      try { return { raw: JSON.parse(txt), from: v }; } catch (e) { /* corrupt: try an older key */ }
    }
    return { raw: null, from: 0 };
  }

  // Progress file for moving devices.
  function exportData(store, now) {
    return { kind: EXPORT_KIND, schema: SCHEMA, exportedAt: new Date(now || Date.now()).toISOString(), progress: store };
  }

  // Parse a progress file (text). Throws Error with a learner-readable message when it is not one.
  // Accepts the export wrapper of this or an older schema, or a bare stored object.
  function importData(text, validIds, catKeys, now) {
    var data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('That file is not a Pulse progress file.');
    var p = data.kind === EXPORT_KIND ? data.progress : data;
    if (data.kind === EXPORT_KIND && isNum(data.schema) && data.schema > SCHEMA) {
      throw new Error('That file was made by a newer version of Pulse. Update the app and try again.');
    }
    if (!p || typeof p !== 'object' || !('missed' in p || 'items' in p || 'stats' in p || 'history' in p)) {
      throw new Error('That file is not a Pulse progress file.');
    }
    return normalize(p, validIds, catKeys, now);
  }

  var api = {
    SCHEMA: SCHEMA, KEYS: KEYS, MODES: MODES, EXAM_SECS: EXAM_SECS, SESSION_SIZES: SESSION_SIZES,
    HISTORY_MAX: HISTORY_MAX, EXPORT_KIND: EXPORT_KIND,
    migrate: migrate, normalize: normalize, readStored: readStored, recordAnswer: recordAnswer, recordRun: recordRun,
    categorySummary: categorySummary, examBudgetMs: examBudgetMs, formatClock: formatClock,
    exportData: exportData, importData: importData
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PulseQuizStore = api;
})(typeof window !== 'undefined' ? window : this);
