// Run: node tests/srs.test.js   (no dependencies)
'use strict';
const assert = require('assert');
const SRS = require('../js/srs.js');
const { CATEGORIES, QUESTIONS } = require('../js/questions.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; }
}
const CATS = Object.keys(CATEGORIES);
const at = (day, hour = 12) => new Date(2026, 0, day, hour).getTime();   // local time, Jan 2026
// Deterministic RNG for session building.
function rng(seed = 1) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

test('dayNum: same local day → same number, next day → +1, independent of hour', () => {
  assert.strictEqual(SRS.dayNum(at(10, 0)), SRS.dayNum(at(10, 23)));
  assert.strictEqual(SRS.dayNum(at(11, 1)) - SRS.dayNum(at(10, 23)), 1);
});

test('quality grades: correctness × confidence', () => {
  assert.deepStrictEqual([1, 2, 3, null].map(c => SRS.quality(true, c)), [3, 4, 5, 4]);
  assert.deepStrictEqual([1, 2, 3, null].map(c => SRS.quality(false, c)), [2, 1, 0, 1]);
});

test('review: correct answers grow the interval 1 → 3 → ×ease', () => {
  let it = SRS.review(null, true, 3, at(1));
  assert.strictEqual(it.reps, 1); assert.strictEqual(it.iv, 1); assert.strictEqual(it.due, SRS.dayNum(at(2)));
  assert.strictEqual(it.ef, 2.6);
  it = SRS.review(it, true, 3, at(2));
  assert.strictEqual(it.iv, 3); assert.strictEqual(it.due, SRS.dayNum(at(5)));
  it = SRS.review(it, true, 3, at(5));
  assert.strictEqual(it.iv, Math.round(3 * it.ef));
  assert.ok(it.iv > 3);
  assert.strictEqual(it.n, 3); assert.strictEqual(it.c, 3); assert.strictEqual(it.lapses, 0); assert.strictEqual(it.ema, 1);
});

test('review: a wrong answer is a lapse due today and lowers ease (floor 1.3)', () => {
  let it = SRS.review(null, true, 3, at(1));
  it = SRS.review(it, true, 3, at(2));
  it = SRS.review(it, false, 3, at(5));            // confidently wrong
  assert.strictEqual(it.reps, 0); assert.strictEqual(it.iv, 0);
  assert.strictEqual(it.due, SRS.dayNum(at(5)));
  assert.strictEqual(it.lapses, 1);
  assert.ok(it.ef < 2.7);
  for (let i = 0; i < 20; i++) it = SRS.review(it, false, 3, at(6));
  assert.strictEqual(it.ef, SRS.EF_MIN);
  for (let i = 0; i < 40; i++) it = SRS.review(it, true, 3, at(7));
  assert.ok(it.ef <= SRS.EF_MAX);
});

test('review: a lucky guess passes but with a smaller ease gain than a sure answer', () => {
  const sure = SRS.review(null, true, 3, at(1));
  const guess = SRS.review(null, true, 1, at(1));
  assert.strictEqual(guess.iv, 1);
  assert.ok(guess.ef < sure.ef);
  assert.strictEqual(guess.conf, 1);
  assert.strictEqual(SRS.review(null, true, 7, at(1)).conf, null);   // out-of-range rating ignored
});

test('mastery: 0 when unseen, decays with time past the interval, lower with low confidence', () => {
  assert.strictEqual(SRS.mastery(undefined, at(1)), 0);
  const it = SRS.review(SRS.review(null, true, 3, at(1)), true, 3, at(2)); // iv 3
  const fresh = SRS.mastery(it, at(2));
  assert.ok(fresh > 0.9 && fresh <= 1);
  const later = SRS.mastery(it, at(5)), muchLater = SRS.mastery(it, at(30));
  assert.ok(later < fresh && muchLater < later && muchLater >= 0.5 * fresh - 1e-9);
  const guessed = SRS.review(SRS.review(null, true, 1, at(1)), true, 1, at(2));
  assert.ok(SRS.mastery(guessed, at(2)) < fresh);
  const wrong = SRS.review(null, false, null, at(1));
  assert.strictEqual(SRS.mastery(wrong, at(1)), 0);
});

test('isDue and level', () => {
  const it = SRS.review(null, true, 3, at(1));
  assert.ok(!SRS.isDue(it, at(1))); assert.ok(SRS.isDue(it, at(2)));
  assert.ok(!SRS.isDue(undefined, at(2)));
  assert.strictEqual(SRS.level([1, 1]), 'steady');                 // too few answers to judge
  assert.strictEqual(SRS.level([1, 1, 1, 1, 1, 1, 1]), 'stretch');
  assert.strictEqual(SRS.level([0, 0, 1, 0, 1, 0]), 'ease');
  assert.strictEqual(SRS.level([1, 1, 0, 1, 0, 1, 1]), 'steady');
});

// Build an items map: `due` ids lapsed (due today), `weak` ids reviewed long ago with poor accuracy,
// `strong` ids recently mastered and not due.
function scenario(now) {
  const items = {};
  const ids = QUESTIONS.map(q => q.id);
  ids.slice(0, 5).forEach(id => { items[id] = SRS.review(null, false, null, now); });
  ids.slice(5, 10).forEach(id => {
    let it = SRS.review(null, false, null, now - 9 * SRS.DAY_MS);
    it = SRS.review(it, true, 1, now - 8 * SRS.DAY_MS);    // guessed right → due in 1 day... then reviewed again:
    it = SRS.review(it, true, 1, now - 1 * SRS.DAY_MS);    // due in 3 days, but ema/conf keep mastery low
    items[id] = it;
  });
  ids.slice(10, 20).forEach(id => {
    let it = SRS.review(null, true, 3, now - 2 * SRS.DAY_MS);
    it = SRS.review(it, true, 3, now - 1 * SRS.DAY_MS);
    items[id] = it;
  });
  return { items, due: ids.slice(0, 5), weak: ids.slice(5, 10), strong: ids.slice(10, 20) };
}

test('buildSession: due first, then weak, then new; never duplicates', () => {
  const now = at(15);
  const { items, due, weak } = scenario(now);
  assert.ok(weak.every(id => !SRS.isDue(items[id], now) && SRS.mastery(items[id], now) < SRS.WEAK));
  const s = SRS.buildSession(items, QUESTIONS, [], { now, size: 20, rng: rng() });
  const got = s.questions.map(q => q.id);
  assert.strictEqual(got.length, 20);
  assert.strictEqual(new Set(got).size, 20);
  assert.deepStrictEqual(got.slice(0, 5).sort(), due.slice().sort());
  assert.deepStrictEqual(got.slice(5, 10).sort(), weak.slice().sort());
  assert.ok(got.slice(10).every(id => !items[id]));               // the rest are unseen questions
  assert.deepStrictEqual(s.counts, { due: 5, weak: 5, new: 10, early: 0 });
  assert.strictEqual(s.level, 'steady');
});

test('buildSession: new-question share follows the difficulty level', () => {
  const now = at(15);
  const items = {};
  const size = 20;
  // Plenty of due items so the level, not supply, limits new questions.
  QUESTIONS.slice(0, 40).forEach(q => { items[q.id] = SRS.review(null, false, null, now); });
  const n = perf => SRS.buildSession(items, QUESTIONS, perf, { now, size, rng: rng() }).counts.new;
  assert.strictEqual(n([0, 0, 0, 0, 0, 0]), Math.round(size * SRS.LEVELS.ease.newShare));
  assert.strictEqual(n([1, 0, 1, 1, 0, 1]), Math.round(size * SRS.LEVELS.steady.newShare));
  assert.strictEqual(n([1, 1, 1, 1, 1, 1]), Math.round(size * SRS.LEVELS.stretch.newShare));
});

test('buildSession: stretch draws new questions from the weakest category first, ease from the strongest', () => {
  const now = at(15);
  const items = {};
  // Cardiac well mastered, neuro attempted and missed; everything else untouched (mastery 0).
  const qs = QUESTIONS.filter(q => q.cat === 'cardiac' || q.cat === 'neuro');
  qs.filter(q => q.cat === 'cardiac').slice(0, 20).forEach(q => {
    items[q.id] = SRS.review(SRS.review(null, true, 3, now - SRS.DAY_MS), true, 3, now);
  });
  qs.filter(q => q.cat === 'neuro').slice(0, 3).forEach(q => {
    // Missed long ago, then right once (not due, low mastery) so neuro stays the weakest seen category.
    items[q.id] = SRS.review(SRS.review(null, false, 1, now - 20 * SRS.DAY_MS), true, 1, now - 9 * SRS.DAY_MS);
  });
  const stretch = SRS.buildSession(items, qs, [1, 1, 1, 1, 1, 1], { now, size: 4, rng: rng() });
  const newOnes = stretch.questions.filter(q => !items[q.id]);
  assert.strictEqual(newOnes[0].cat, 'neuro');
  const ease = SRS.buildSession(items, qs, [0, 0, 0, 0, 0, 0], { now, size: 4, rng: rng() });
  assert.strictEqual(ease.questions.filter(q => !items[q.id])[0].cat, 'cardiac');
});

test('buildSession: when nothing is due or new, falls back to early review of the least-mastered', () => {
  const now = at(15);
  const qs = QUESTIONS.slice(0, 6);
  const items = {};
  qs.forEach((q, i) => {
    let it = SRS.review(null, true, 3, now - SRS.DAY_MS);
    it = SRS.review(it, true, i < 3 ? 3 : 2, now);
    items[q.id] = it;
  });
  const s = SRS.buildSession(items, qs, [], { now, size: 10, rng: rng() });
  assert.strictEqual(s.questions.length, 6);
  assert.strictEqual(s.counts.early, 6);
  assert.ok(qs.slice(3).map(q => q.id).includes(s.questions[0].id));   // unsure ones first
  assert.strictEqual(SRS.buildSession({}, [], [], { now, size: 10, rng: rng() }).questions.length, 0);
});

test('suggestDaily: covers everything due plus some new, bounded 5–40', () => {
  const now = at(15);
  const { items } = scenario(now);
  const s = SRS.suggestDaily(items, QUESTIONS, [], now);
  assert.strictEqual(s.due, 5); assert.strictEqual(s.weak, 5);
  assert.strictEqual(s.size, s.due + 5 + s.newCount);
  assert.ok(s.minutes >= 1);
  const empty = SRS.suggestDaily({}, QUESTIONS, [], now);
  assert.strictEqual(empty.due, 0);
  assert.ok(empty.size >= 5 && empty.size <= 40);
  const many = {};
  QUESTIONS.forEach(q => { many[q.id] = SRS.review(null, false, null, now); });
  assert.strictEqual(SRS.suggestDaily(many, QUESTIONS, [], now).size, 40);
});

test('categoryMastery: one row per category, mean over all questions', () => {
  const now = at(15);
  const { items } = scenario(now);
  const rows = SRS.categoryMastery(items, QUESTIONS, CATS, now);
  assert.deepStrictEqual(rows.map(r => r.cat), CATS);
  rows.forEach(r => {
    assert.strictEqual(r.total, QUESTIONS.filter(q => q.cat === r.cat).length);
    assert.ok(r.mastery >= 0 && r.mastery <= 1);
  });
  assert.strictEqual(rows.reduce((a, r) => a + r.seen, 0), 20);
  assert.strictEqual(rows.reduce((a, r) => a + r.due, 0), 5);
});

test('day streak: consecutive days count up, same day is idempotent, a gap resets', () => {
  let s = SRS.bumpStreak(null, at(1));
  s = SRS.bumpStreak(s, at(1, 20));
  assert.deepStrictEqual([s.count, s.best], [1, 1]);
  s = SRS.bumpStreak(s, at(2)); s = SRS.bumpStreak(s, at(3));
  assert.deepStrictEqual([s.count, s.best], [3, 3]);
  assert.strictEqual(SRS.currentStreak(s, at(4)), 3);               // still alive the next day
  assert.strictEqual(SRS.currentStreak(s, at(5)), 0);               // broken after a missed day
  s = SRS.bumpStreak(s, at(6));
  assert.deepStrictEqual([s.count, s.best], [1, 3]);
  assert.strictEqual(SRS.currentStreak(null, at(6)), 0);
});

console.log(`${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
