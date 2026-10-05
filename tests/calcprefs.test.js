// Run: node --test tests/calcprefs.test.js   (no dependencies)
'use strict';
const test = require('node:test');
const assert = require('assert');
const P = require('../js/calcprefs.js');
const { DRUGS } = require('../js/drugs.js');

const IDS = DRUGS.map(d => d.id);
const MIN = 60 * 1000;

function fakeStorage() {
  const data = {};
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; }
  };
}
function setup(opts = {}) {
  const storage = opts.storage || fakeStorage();
  const clock = { t: 1_000_000_000_000 };
  const prefs = P.createPrefs({ storage, now: () => clock.t, knownIds: opts.knownIds || IDS });
  return { storage, clock, prefs };
}

// ── weight memory ──
test('remembers the weight exactly as typed, with unit and mode', () => {
  const { prefs } = setup();
  prefs.rememberPatient(' 22.5 ', 'kg', 'peds');
  const p = prefs.recallPatient();
  assert.strictEqual(p.value, '22.5');
  assert.strictEqual(p.unit, 'kg');
  assert.strictEqual(p.mode, 'peds');
  assert.strictEqual(p.needsConfirm, false);
  assert.strictEqual(p.ageMs, 0);
});

test('remembered weight survives a reload (new prefs object, same storage)', () => {
  const { storage } = setup();
  P.createPrefs({ storage, now: () => 5 }).rememberPatient('48', 'lb', 'adult');
  const p = P.createPrefs({ storage, now: () => 5 + MIN }).recallPatient();
  assert.strictEqual(p.value, '48');
  assert.strictEqual(p.unit, 'lb');
  assert.strictEqual(p.ageMs, MIN);
});

test('asks "same patient?" only after the confirm timeout', () => {
  const { prefs, clock } = setup();
  prefs.rememberPatient('70', 'kg', 'adult');
  clock.t += P.CONFIRM_AFTER_MS;
  assert.strictEqual(prefs.recallPatient().needsConfirm, false, 'exactly at the limit is still fresh');
  clock.t += 1;
  assert.strictEqual(prefs.recallPatient().needsConfirm, true);
});

test('confirming (or using) the weight restarts the timeout', () => {
  const { prefs, clock } = setup();
  prefs.rememberPatient('70', 'kg', 'adult');
  clock.t += P.CONFIRM_AFTER_MS + MIN;
  assert.ok(prefs.recallPatient().needsConfirm);
  prefs.touchPatient();
  const p = prefs.recallPatient();
  assert.strictEqual(p.needsConfirm, false);
  assert.strictEqual(p.value, '70');
});

test('very old weights are forgotten without a prompt', () => {
  const { prefs, clock, storage } = setup();
  prefs.rememberPatient('70', 'kg', 'adult');
  clock.t += P.FORGET_AFTER_MS + 1;
  assert.strictEqual(prefs.recallPatient(), null);
  assert.ok(!(P.KEYS.patient in storage.data), 'stale entry is deleted');
});

test('clear / empty value forgets the patient', () => {
  const { prefs } = setup();
  prefs.rememberPatient('70', 'kg', 'adult');
  prefs.forgetPatient();
  assert.strictEqual(prefs.recallPatient(), null);
  prefs.rememberPatient('70', 'kg', 'adult');
  prefs.rememberPatient('   ', 'kg', 'adult');
  assert.strictEqual(prefs.recallPatient(), null);
  assert.strictEqual(prefs.touchPatient(), null);
});

test('timestamps from the future (clock change) are discarded', () => {
  const { prefs, clock } = setup();
  prefs.rememberPatient('70', 'kg', 'adult');
  clock.t -= MIN;
  assert.strictEqual(prefs.recallPatient(), null);
});

test('corrupt or tampered stored patient is ignored, never thrown', () => {
  const bad = ['{', '"70"', '{"value":"abc","unit":"kg","at":1}', '{"value":"70","unit":"stone","at":1}',
    '{"value":"70","unit":"kg"}', '{"value":70,"unit":"kg","at":1}', 'null', '[]'];
  for (const raw of bad) {
    const { prefs, storage } = setup();
    storage.data[P.KEYS.patient] = raw;
    assert.strictEqual(prefs.recallPatient(), null, raw);
  }
});

test('unknown unit/mode values are normalised when saved', () => {
  const { prefs } = setup();
  prefs.rememberPatient('70', 'stone', 'neonate');
  const p = prefs.recallPatient();
  assert.strictEqual(p.unit, 'kg');
  assert.strictEqual(p.mode, 'adult');
});

test('works when storage throws (private mode / blocked site data)', () => {
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const prefs = P.createPrefs({ storage: throwing, knownIds: IDS });
  assert.doesNotThrow(() => prefs.rememberPatient('70', 'kg', 'adult'));
  assert.strictEqual(prefs.recallPatient(), null);
  assert.doesNotThrow(() => prefs.toggleFavorite(IDS[0]));
  assert.deepStrictEqual(prefs.getFavorites(), []);
  assert.strictEqual(prefs.getUnit(), 'kg');
});

test('works with no storage at all (in-memory fallback)', () => {
  const prefs = P.createPrefs({});
  prefs.rememberPatient('12', 'kg', 'peds');
  assert.strictEqual(prefs.recallPatient().value, '12');
});

// ── unit preference ──
test('kg/lb preference persists and defaults to kg', () => {
  const { prefs, storage } = setup();
  assert.strictEqual(prefs.getUnit(), 'kg');
  prefs.setUnit('lb');
  assert.strictEqual(P.createPrefs({ storage }).getUnit(), 'lb');
  prefs.setUnit('furlong');
  assert.strictEqual(prefs.getUnit(), 'kg');
});

// ── favorites & recents ──
test('toggleFavorite adds then removes', () => {
  const { prefs } = setup();
  assert.strictEqual(prefs.toggleFavorite('adenosine'), true);
  assert.ok(prefs.isFavorite('adenosine'));
  assert.strictEqual(prefs.toggleFavorite('adenosine'), false);
  assert.deepStrictEqual(prefs.getFavorites(), []);
});

test('recents: most recent first, de-duplicated, capped', () => {
  const { prefs } = setup();
  IDS.slice(0, 7).forEach(id => prefs.pushRecent(id));
  prefs.pushRecent(IDS[3]);
  const r = prefs.getRecents();
  assert.strictEqual(r.length, P.MAX_RECENTS);
  assert.strictEqual(r[0], IDS[3]);
  assert.strictEqual(new Set(r).size, r.length);
});

test('favorites/recents for drugs removed from the data are dropped', () => {
  const { storage } = setup();
  storage.data[P.KEYS.favorites] = JSON.stringify(['adenosine', 'not_a_drug', 'adenosine', 7]);
  storage.data[P.KEYS.recents] = JSON.stringify(['gone', 'naloxone']);
  const prefs = P.createPrefs({ storage, knownIds: IDS });
  assert.deepStrictEqual(prefs.getFavorites(), ['adenosine']);
  assert.deepStrictEqual(prefs.getRecents(), ['naloxone']);
  prefs.pushRecent('not_a_drug');
  assert.deepStrictEqual(prefs.getRecents(), ['naloxone']);
});

// ── age text ──
test('formatAge', () => {
  assert.strictEqual(P.formatAge(10 * 1000), 'just now');
  assert.strictEqual(P.formatAge(5 * MIN), '5 min ago');
  assert.strictEqual(P.formatAge(60 * MIN), '1 hr ago');
  assert.strictEqual(P.formatAge(125 * MIN), '2 hr 5 min ago');
  assert.strictEqual(P.formatAge(-5), 'just now');
});

// ── search ──
test('search matches word starts across name, group and id', () => {
  const ids = q => P.searchDrugs(DRUGS, q).map(d => d.id);
  assert.ok(ids('epi ana').includes('epi_anaphylaxis'));
  assert.ok(!ids('epi ana').includes('epi_arrest'));
  assert.strictEqual(ids('norepi')[0], 'norepi');
  assert.ok(ids('TXA').includes('txa'), 'case-insensitive, matches abbreviation');
  assert.ok(ids('kcentra').length === 3);
  assert.ok(ids('cardiac arrest').includes('epi_arrest'), 'group name');
  assert.deepStrictEqual(ids('   '), []);
  assert.deepStrictEqual(ids('zzzz'), []);
  assert.ok(ids('a').length <= 8, 'default limit');
});

test('search ranks names that start with the query first', () => {
  const r = P.searchDrugs(DRUGS, 'amio', 20).map(d => d.id);
  assert.ok(r.length >= 3);
  r.forEach(id => assert.ok(/^amiodarone/.test(id)));
  const e = P.searchDrugs(DRUGS, 'epinephrine', 20);
  assert.ok(/^Epinephrine/.test(e[0].name));
});
