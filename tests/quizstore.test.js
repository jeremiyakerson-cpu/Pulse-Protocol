// Run: node tests/quizstore.test.js  (or node --test tests/*.test.js)   (no dependencies)
'use strict';
const assert = require('assert');
const QS = require('../js/quizstore.js');
const SRS = require('../js/srs.js');
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

const at = (day, hour = 12) => new Date(2026, 0, day, hour).getTime();

test('migrate: a real schema-1 store upgrades to schema 2 without losing anything', () => {
  const v1 = {
    missed: [IDS[0], IDS[3], 'retired-id'],
    history: [{ t: at(3), score: 7, total: 10, review: false, mode: 'study' },
              { t: at(4), score: 8, total: 10, review: false, mode: 'exam' },
              { t: at(5, 9), score: 2, total: 2, review: true, mode: 'study' }],
    cats: ['cardiac', 'resp'], length: 20, mode: 'exam', examSecs: 90,
    stats: { cardiac: { seen: 12, correct: 9 }, resp: { seen: 10, correct: 8 } }
  };
  const s = QS.normalize(JSON.parse(JSON.stringify(v1)), IDS, CATS, at(9));
  assert.strictEqual(s.schema, 2);
  // Everything v1 had is kept as-is.
  assert.deepStrictEqual(s.missed, [IDS[0], IDS[3]]);
  assert.deepStrictEqual(s.history, v1.history);
  assert.deepStrictEqual(s.cats, v1.cats); assert.strictEqual(s.length, 20);
  assert.strictEqual(s.mode, 'exam'); assert.strictEqual(s.examSecs, 90);
  assert.deepStrictEqual(s.stats, v1.stats);
  // Missed questions become lapsed items, due on the day of the last session (so due now).
  assert.deepStrictEqual(Object.keys(s.items).sort(), [IDS[0], IDS[3]].sort());
  const it = s.items[IDS[0]];
  assert.deepStrictEqual([it.n, it.c, it.reps, it.iv, it.lapses], [1, 0, 0, 0, 1]);
  assert.strictEqual(it.due, SRS.dayNum(at(5)));
  assert.ok(SRS.isDue(it, at(9)));
  // Day streak rebuilt from history: Jan 3, 4, 5 in a row.
  assert.deepStrictEqual(s.streak, { last: SRS.dayNum(at(5)), count: 3, best: 3 });
  assert.deepStrictEqual(s.perf, []);
  assert.strictEqual(s.askConf, true); assert.strictEqual(s.sessionSize, 20);
});

test('migrate: empty / garbage input and a v1 store without timestamps', () => {
  [null, undefined, 42, 'x', [], {}].forEach(raw => {
    const s = QS.normalize(raw, IDS, CATS, at(1));
    assert.strictEqual(s.schema, 2);
    assert.deepStrictEqual(s.items, {});
    assert.deepStrictEqual(s.streak, { last: null, count: 0, best: 0 });
  });
  const s = QS.normalize({ missed: [IDS[2]], history: [{ score: 1, total: 2 }] }, IDS, CATS, at(7));
  assert.strictEqual(s.items[IDS[2]].due, SRS.dayNum(at(7)));      // falls back to "now"
  assert.deepStrictEqual(s.streak, { last: null, count: 0, best: 0 });
});

test('migrate is idempotent and leaves a schema-2 store alone', () => {
  const once = QS.normalize({ missed: [IDS[0]], history: [{ t: at(2), score: 1, total: 2 }] }, IDS, CATS, at(3));
  const twice = QS.normalize(JSON.parse(JSON.stringify(once)), IDS, CATS, at(20));
  assert.deepStrictEqual(twice, once);
  assert.strictEqual(QS.migrate(once, at(20)), once);
});

test('normalize (schema 2) drops bad items, unknown ids and bad perf/streak values', () => {
  const good = SRS.review(null, true, 3, at(1));
  const s = QS.normalize({
    schema: 2,
    items: {
      [IDS[0]]: good,
      [IDS[1]]: { ...good, c: 5, n: 2 },          // more correct than seen
      [IDS[2]]: { ...good, due: 'soon' },
      [IDS[3]]: { ...good, ef: 99, conf: 9 },     // repaired, not dropped
      'retired-id': good
    },
    perf: [1, 0, 2, 'x', 1], streak: { last: 'x', count: 2, best: 1 }, askConf: false, sessionSize: 7, mode: 'adaptive'
  }, IDS, CATS);
  assert.deepStrictEqual(Object.keys(s.items).sort(), [IDS[0], IDS[3]].sort());
  assert.strictEqual(s.items[IDS[3]].ef, SRS.EF_MAX); assert.strictEqual(s.items[IDS[3]].conf, null);
  assert.deepStrictEqual(s.perf, [1, 0, 1]);
  assert.deepStrictEqual(s.streak, { last: null, count: 0, best: 0 });
  assert.strictEqual(s.askConf, false); assert.strictEqual(s.sessionSize, 20); assert.strictEqual(s.mode, 'adaptive');
});

test('recordAnswer feeds the scheduler, recent performance and the day streak', () => {
  const s = QS.normalize(null, IDS, CATS);
  QS.recordAnswer(s, IDS[0], 'cardiac', true, 3, at(1));
  QS.recordAnswer(s, IDS[1], 'cardiac', false, 2, at(2));
  assert.strictEqual(s.items[IDS[0]].iv, 1); assert.strictEqual(s.items[IDS[0]].conf, 3);
  assert.strictEqual(s.items[IDS[1]].lapses, 1);
  assert.deepStrictEqual(s.perf, [1, 0]);
  assert.deepStrictEqual(s.streak, { last: SRS.dayNum(at(2)), count: 2, best: 2 });
  for (let i = 0; i < 30; i++) QS.recordAnswer(s, IDS[2], 'cardiac', true, null, at(2));
  assert.strictEqual(s.perf.length, SRS.PERF_MAX);
});

test('readStored prefers schema 2, falls back to v1, skips corrupt JSON', () => {
  const ls = {};
  const get = k => (k in ls ? ls[k] : null);
  assert.deepStrictEqual(QS.readStored(get), { raw: null, from: 0 });
  ls[QS.KEYS[1]] = JSON.stringify({ missed: [IDS[0]] });
  assert.strictEqual(QS.readStored(get).from, 1);
  ls[QS.KEYS[2]] = '{not json';
  assert.strictEqual(QS.readStored(get).from, 1);
  ls[QS.KEYS[2]] = JSON.stringify({ schema: 2 });
  assert.deepStrictEqual(QS.readStored(get), { raw: { schema: 2 }, from: 2 });
});

test('export → import round-trips; import accepts a bare v1 store and rejects junk', () => {
  const s = QS.normalize({ missed: [IDS[0]], history: [{ t: at(2), score: 1, total: 2 }] }, IDS, CATS, at(3));
  QS.recordAnswer(s, IDS[5], QUESTIONS[5].cat, true, 3, at(3));
  const file = JSON.stringify(QS.exportData(s, at(3)));
  assert.strictEqual(JSON.parse(file).kind, QS.EXPORT_KIND);
  assert.deepStrictEqual(QS.importData(file, IDS, CATS, at(4)), s);
  const fromV1 = QS.importData(JSON.stringify({ missed: [IDS[1]], stats: {} }), IDS, CATS, at(4));
  assert.strictEqual(fromV1.schema, 2); assert.ok(fromV1.items[IDS[1]]);
  ['not json', '[]', '"x"', '{}', '{"foo":1}'].forEach(t => assert.throws(() => QS.importData(t, IDS, CATS), /Pulse progress|valid JSON/));
  const future = JSON.stringify({ kind: QS.EXPORT_KIND, schema: 99, progress: {} });
  assert.throws(() => QS.importData(future, IDS, CATS), /newer version/);
});

console.log(`${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
