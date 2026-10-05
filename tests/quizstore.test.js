// Run: node tests/quizstore.test.js   (no dependencies)
'use strict';
const assert = require('assert');
const QS = require('../js/quizstore.js');
const { CATEGORIES, QUESTIONS } = require('../js/questions.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; }
}
const CATS = Object.keys(CATEGORIES);
const IDS = QUESTIONS.map(q => q.id);

test('normalize: garbage / null / v1-shaped store all load with defaults', () => {
  [null, undefined, 42, 'x', [], {}].forEach(raw => {
    const s = QS.normalize(raw, IDS, CATS);
    assert.deepStrictEqual(s.missed, []); assert.deepStrictEqual(s.history, []); assert.deepStrictEqual(s.stats, {});
    assert.strictEqual(s.mode, 'study'); assert.strictEqual(s.examSecs, 60);
  });
  // A pass-1 store (no mode/examSecs/stats) keeps its missed list and history.
  const v1 = { missed: [IDS[0]], history: [{ t: 1, score: 3, total: 10, review: false }], cats: ['cardiac'], length: 20 };
  const s = QS.normalize(v1, IDS, CATS);
  assert.deepStrictEqual(s.missed, [IDS[0]]); assert.strictEqual(s.history.length, 1);
  assert.deepStrictEqual(s.cats, ['cardiac']); assert.strictEqual(s.length, 20);
});
test('normalize drops unknown ids, duplicate ids, unknown cats, bad stats and bad history', () => {
  const s = QS.normalize({
    missed: ['nope', IDS[1], IDS[1]],
    cats: ['cardiac', 'bogus'],
    mode: 'speedrun', examSecs: 7,
    history: [{ score: 5, total: 3 }, { score: -1, total: 3 }, { score: 2, total: 0 }, null, { t: 1, score: 2, total: 4 }],
    stats: { cardiac: { seen: 3, correct: 5 }, resp: { seen: 2, correct: 1 }, bogus: { seen: 1, correct: 1 }, neuro: { seen: 'x', correct: 0 } }
  }, IDS, CATS);
  assert.deepStrictEqual(s.missed, [IDS[1]]);
  assert.deepStrictEqual(s.cats, ['cardiac']);
  assert.strictEqual(s.mode, 'study'); assert.strictEqual(s.examSecs, 60);
  assert.strictEqual(s.history.length, 1);
  assert.deepStrictEqual(s.stats, { resp: { seen: 2, correct: 1 } });
});
test('recordAnswer updates per-category stats and the missed list', () => {
  const s = QS.normalize(null, IDS, CATS);
  QS.recordAnswer(s, 'a', 'cardiac', false);
  QS.recordAnswer(s, 'a', 'cardiac', false);        // missed twice → listed once
  QS.recordAnswer(s, 'b', 'resp', true);
  assert.deepStrictEqual(s.stats.cardiac, { seen: 2, correct: 0 });
  assert.deepStrictEqual(s.stats.resp, { seen: 1, correct: 1 });
  assert.deepStrictEqual(s.missed, ['a']);
  QS.recordAnswer(s, 'a', 'cardiac', true);         // correct answer clears it
  assert.deepStrictEqual(s.missed, []);
  assert.deepStrictEqual(s.stats.cardiac, { seen: 3, correct: 1 });
});
test('recordRun keeps only the last HISTORY_MAX runs', () => {
  const s = QS.normalize(null, IDS, CATS);
  for (let i = 0; i < QS.HISTORY_MAX + 5; i++) QS.recordRun(s, { t: i, score: 1, total: 2 });
  assert.strictEqual(s.history.length, QS.HISTORY_MAX);
  assert.strictEqual(s.history[0].t, 5);
});
test('categorySummary: order, rounding, and null pct when unseen', () => {
  const s = QS.normalize({ stats: { cardiac: { seen: 3, correct: 2 } } }, IDS, CATS);
  const rows = QS.categorySummary(s, CATS);
  assert.deepStrictEqual(rows.map(r => r.cat), CATS);
  assert.strictEqual(rows[0].pct, 67);
  assert.ok(rows.slice(1).every(r => r.pct === null && r.seen === 0));
});
test('stats survive a JSON round-trip through storage', () => {
  const s = QS.normalize(null, IDS, CATS);
  QS.recordAnswer(s, IDS[0], QUESTIONS[0].cat, false);
  const back = QS.normalize(JSON.parse(JSON.stringify(s)), IDS, CATS);
  assert.deepStrictEqual(back, s);
});
test('exam budget and clock formatting', () => {
  assert.strictEqual(QS.examBudgetMs(20, 60), 1200000);
  assert.strictEqual(QS.formatClock(1200000), '20:00');
  assert.strictEqual(QS.formatClock(61000), '1:01');
  assert.strictEqual(QS.formatClock(500), '0:01');   // rounds up so 0:00 means time is actually up
  assert.strictEqual(QS.formatClock(-5), '0:00');
});

console.log(`${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
