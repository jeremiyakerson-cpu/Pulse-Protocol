/*
 * Pulse-Protocol quiz progress — pure functions over the saved progress object (no DOM, no storage).
 *   node tests/quizstore.test.js
 * In the browser they are exposed as window.PulseQuizStore; quiz.js does the actual localStorage I/O.
 *
 * Stored shape (localStorage key pulseProtocol.quiz.v1 — fields added in pass 2 default in normalize()):
 *   { missed: [id], history: [{ t, score, total, review, mode }], cats: [cat] | null, length: n,
 *     mode: 'study' | 'exam', examSecs: n, stats: { [cat]: { seen, correct } } }
 */
(function (root) {
  'use strict';

  var MODES = ['study', 'exam'];
  var EXAM_SECS = [45, 60, 90];   // seconds allowed per question in exam mode
  var HISTORY_MAX = 20;

  function isCount(n) { return typeof n === 'number' && isFinite(n) && n >= 0 && Math.floor(n) === n; }

  // Repair whatever came out of storage: drop unknown ids/categories and bad numbers, fill defaults.
  function normalize(raw, validIds, catKeys) {
    var s = raw && typeof raw === 'object' ? raw : {};
    var ids = {};
    (validIds || []).forEach(function (id) { ids[id] = true; });
    var out = {
      missed: Array.isArray(s.missed) ? s.missed.filter(function (id, i, a) { return ids[id] && a.indexOf(id) === i; }) : [],
      history: Array.isArray(s.history)
        ? s.history.filter(function (h) { return h && isCount(h.score) && isCount(h.total) && h.total > 0 && h.score <= h.total; }).slice(-HISTORY_MAX)
        : [],
      cats: Array.isArray(s.cats) ? s.cats.filter(function (c) { return catKeys.indexOf(c) !== -1; }) : null,
      length: s.length,
      mode: MODES.indexOf(s.mode) !== -1 ? s.mode : 'study',
      examSecs: EXAM_SECS.indexOf(s.examSecs) !== -1 ? s.examSecs : 60,
      stats: {}
    };
    catKeys.forEach(function (c) {
      var st = s.stats && s.stats[c];
      if (st && isCount(st.seen) && isCount(st.correct) && st.correct <= st.seen) out.stats[c] = { seen: st.seen, correct: st.correct };
    });
    return out;
  }

  // One answered question: update lifetime per-category stats and the missed list (a correct answer clears it).
  function recordAnswer(store, id, cat, correct) {
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

  var api = {
    MODES: MODES, EXAM_SECS: EXAM_SECS, HISTORY_MAX: HISTORY_MAX,
    normalize: normalize, recordAnswer: recordAnswer, recordRun: recordRun,
    categorySummary: categorySummary, examBudgetMs: examBudgetMs, formatClock: formatClock
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PulseQuizStore = api;
})(typeof window !== 'undefined' ? window : this);
