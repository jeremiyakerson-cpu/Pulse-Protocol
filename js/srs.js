/*
 * Pulse-Protocol adaptive study — spaced-repetition scheduler and mastery model (pure functions, no DOM/storage).
 *   node --test tests/srs.test.js
 * In the browser it is exposed as window.PulseSRS; js/quizstore.js keeps one record per question and calls review().
 *
 * Scheduler: SM-2 (SuperMemo 2). Each answer becomes a quality grade 0–5 from correctness plus the optional
 * confidence rating (1 guessed · 2 unsure · 3 sure). A grade < 3 is a lapse: the item is due again today.
 * Otherwise the interval grows 1 → 3 → interval × ease days, and the ease factor moves with the grade.
 *
 * Item record (one per question id that has been answered):
 *   { n: times seen, c: times correct, ema: recency-weighted accuracy 0–1, ef: ease factor,
 *     iv: interval in days, reps: correct reviews in a row, due: local day number, last: ms timestamp,
 *     lapses: count, conf: last confidence 1–3 or null }
 *
 * Mastery (0–1) of an item = accuracy (ema) × recency (how much of the interval has elapsed) × confidence.
 * Unseen items have mastery 0. Category mastery is the mean over every question in the category.
 */
(function (root) {
  'use strict';

  var DAY_MS = 86400000;
  var EF_START = 2.5, EF_MIN = 1.3, EF_MAX = 3.0;
  var EMA_WEIGHT = 0.4;           // weight of the newest answer in the recency-weighted accuracy
  var WEAK = 0.6;                 // mastery below this (once seen) counts as weak
  var PERF_MAX = 20;              // recent answers kept for the difficulty level
  var CONF = { 1: 'Guessed', 2: 'Unsure', 3: 'Sure' };
  var CONF_FACTOR = { 1: 0.7, 2: 0.85, 3: 1 };
  var CONF_NONE = 0.9;
  // Share of a session given to unseen questions at each difficulty level.
  var LEVELS = {
    ease: { label: 'Consolidate', newShare: 0.1 },
    steady: { label: 'Steady', newShare: 0.3 },
    stretch: { label: 'Stretch', newShare: 0.5 }
  };

  // Local calendar day number (days since 1970-01-01 in the learner's time zone).
  function dayNum(t) {
    var d = new Date(t);
    return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
  }

  // SM-2 quality grade. Being sure of a wrong answer is the worst case; guessing right is a weak pass.
  //            guessed  unsure  sure   (no rating)
  //   correct     3        4       5      4
  //   wrong       2        1       0      1
  var Q_RIGHT = { 1: 3, 2: 4, 3: 5 }, Q_WRONG = { 1: 2, 2: 1, 3: 0 };
  function quality(correct, conf) {
    var table = correct ? Q_RIGHT : Q_WRONG;
    return table[conf] !== undefined ? table[conf] : correct ? 4 : 1;
  }

  function newItem() {
    return { n: 0, c: 0, ema: 0, ef: EF_START, iv: 0, reps: 0, due: null, last: null, lapses: 0, conf: null };
  }

  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function round2(x) { return Math.round(x * 100) / 100; }

  // Apply one answer to an item record (mutates and returns it).
  function review(item, correct, conf, now) {
    var it = item || newItem();
    var q = quality(correct, conf);
    var today = dayNum(now);
    it.ema = it.n ? round2(it.ema * (1 - EMA_WEIGHT) + (correct ? 1 : 0) * EMA_WEIGHT) : (correct ? 1 : 0);
    it.n++;
    if (correct) it.c++;
    it.ef = round2(clamp(it.ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02), EF_MIN, EF_MAX));
    if (q < 3) {
      it.lapses++;
      it.reps = 0;
      it.iv = 0;
    } else {
      it.reps++;
      it.iv = it.reps === 1 ? 1 : it.reps === 2 ? 3 : Math.max(it.iv + 1, Math.round(it.iv * it.ef));
    }
    it.due = today + it.iv;
    it.last = now;
    it.conf = conf === 1 || conf === 2 || conf === 3 ? conf : null;
    return it;
  }

  // 0–1. Recency halves the retention estimate each time a full interval passes past the last review.
  function mastery(item, now) {
    if (!item || !item.n) return 0;
    var elapsed = Math.max(0, dayNum(now) - dayNum(item.last));
    var retention = Math.pow(0.5, elapsed / Math.max(1, item.iv));
    var conf = item.conf ? CONF_FACTOR[item.conf] : CONF_NONE;
    return clamp(item.ema * (0.5 + 0.5 * retention) * conf, 0, 1);
  }

  function isDue(item, now) { return !!(item && item.n && item.due !== null && item.due <= dayNum(now)); }

  // Difficulty level from the learner's recent answers (array of 0/1, oldest first).
  function level(perf) {
    if (!perf || perf.length < 5) return 'steady';
    var acc = perf.reduce(function (a, b) { return a + b; }, 0) / perf.length;
    return acc >= 0.85 ? 'stretch' : acc < 0.6 ? 'ease' : 'steady';
  }

  // Per-category mastery rows for the progress view.
  function categoryMastery(items, questions, catKeys, now) {
    return catKeys.map(function (cat) {
      var qs = questions.filter(function (q) { return q.cat === cat; });
      var sum = 0, seen = 0, due = 0;
      qs.forEach(function (q) {
        var it = items[q.id];
        sum += mastery(it, now);
        if (it && it.n) seen++;
        if (isDue(it, now)) due++;
      });
      return { cat: cat, total: qs.length, seen: seen, due: due, mastery: qs.length ? sum / qs.length : 0 };
    });
  }

  function seededShuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /*
   * Build an adaptive session of up to `size` questions from `questions` (already filtered to the chosen
   * categories). Order: due items (most overdue first), then weak items (lowest mastery first), then new
   * items, then — only if the session is still short — early review of the least-mastered remaining items.
   * The difficulty level sets how many slots go to new items and which categories they come from:
   * stretch pulls new questions from the learner's weakest categories, ease from the strongest.
   * Returns { questions, level, counts: { due, weak, new, early } }.
   */
  function buildSession(items, questions, perf, opts) {
    var now = opts.now, size = opts.size, rng = opts.rng || Math.random;
    var lvl = level(perf);
    var today = dayNum(now);
    var due = [], weak = [], fresh = [], rest = [];
    questions.forEach(function (q) {
      var it = items[q.id];
      if (!it || !it.n) fresh.push(q);
      else if (it.due <= today) due.push(q);
      else if (mastery(it, now) < WEAK) weak.push(q);
      else rest.push(q);
    });
    // Most overdue relative to its interval first; ties → lower mastery first.
    function overdue(q) { var it = items[q.id]; return (today - it.due) / Math.max(1, it.iv); }
    due = seededShuffle(due, rng).sort(function (a, b) {
      return overdue(b) - overdue(a) || mastery(items[a.id], now) - mastery(items[b.id], now);
    });
    weak = seededShuffle(weak, rng).sort(function (a, b) { return mastery(items[a.id], now) - mastery(items[b.id], now); });
    rest = seededShuffle(rest, rng).sort(function (a, b) { return mastery(items[a.id], now) - mastery(items[b.id], now); });

    // New items: interleave categories, ordered by category mastery per the level.
    var catM = {};
    questions.forEach(function (q) { if (!(q.cat in catM)) catM[q.cat] = []; });
    Object.keys(catM).forEach(function (cat) {
      var qs = questions.filter(function (q) { return q.cat === cat; });
      catM[cat] = qs.reduce(function (s, q) { return s + mastery(items[q.id], now); }, 0) / qs.length;
    });
    var cats = seededShuffle(Object.keys(catM), rng);
    if (lvl === 'stretch') cats.sort(function (a, b) { return catM[a] - catM[b]; });
    if (lvl === 'ease') cats.sort(function (a, b) { return catM[b] - catM[a]; });
    var buckets = cats.map(function (cat) { return seededShuffle(fresh.filter(function (q) { return q.cat === cat; }), rng); });
    var freshOrdered = [];
    for (var more = true; more;) {
      more = false;
      buckets.forEach(function (b) { if (b.length) { freshOrdered.push(b.shift()); more = true; } });
    }

    var newSlots = Math.min(freshOrdered.length, Math.round(size * LEVELS[lvl].newShare));
    var out = { due: [], weak: [], new: [], early: [] };
    var reviewSlots = size - newSlots;
    out.due = due.slice(0, reviewSlots);
    out.weak = weak.slice(0, reviewSlots - out.due.length);
    var left = size - out.due.length - out.weak.length;
    out.new = freshOrdered.slice(0, left);
    left -= out.new.length;
    out.early = rest.slice(0, Math.max(0, left));
    return {
      questions: out.due.concat(out.weak, out.new, out.early),
      level: lvl,
      counts: { due: out.due.length, weak: out.weak.length, new: out.new.length, early: out.early.length }
    };
  }

  // Suggested daily session: everything due plus the level's share of new questions, 5–40 questions.
  function suggestDaily(items, questions, perf, now) {
    var due = 0, fresh = 0, weak = 0;
    questions.forEach(function (q) {
      var it = items[q.id];
      if (!it || !it.n) fresh++;
      else if (isDue(it, now)) due++;
      else if (mastery(it, now) < WEAK) weak++;
    });
    var lvl = level(perf);
    var newCount = Math.min(fresh, Math.round(10 * LEVELS[lvl].newShare) + (due ? 0 : 4));
    var size = clamp(due + Math.min(weak, 5) + newCount, Math.min(5, questions.length), 40);
    return { size: size, due: due, weak: weak, fresh: fresh, newCount: newCount, level: lvl, minutes: Math.max(1, Math.round(size * 0.75)) };
  }

  // Daily streak: { last: day number of the most recent study day, count, best }.
  function bumpStreak(streak, now) {
    var s = streak || { last: null, count: 0, best: 0 };
    var d = dayNum(now);
    if (s.last === d) return s;
    s.count = s.last === d - 1 ? s.count + 1 : 1;
    s.last = d;
    s.best = Math.max(s.best, s.count);
    return s;
  }

  // Streak as shown today: still alive if the learner studied today or yesterday.
  function currentStreak(streak, now) {
    if (!streak || streak.last === null) return 0;
    return dayNum(now) - streak.last <= 1 ? streak.count : 0;
  }

  var api = {
    DAY_MS: DAY_MS, EF_START: EF_START, EF_MIN: EF_MIN, EF_MAX: EF_MAX, WEAK: WEAK, PERF_MAX: PERF_MAX,
    CONF: CONF, LEVELS: LEVELS,
    dayNum: dayNum, quality: quality, newItem: newItem, review: review, mastery: mastery, isDue: isDue,
    level: level, categoryMastery: categoryMastery, buildSession: buildSession, suggestDaily: suggestDaily,
    bumpStreak: bumpStreak, currentStreak: currentStreak
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PulseSRS = api;
})(typeof window !== 'undefined' ? window : this);
