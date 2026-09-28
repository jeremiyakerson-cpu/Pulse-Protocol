// Run: node tests/questions.test.js   (no dependencies)
'use strict';
const assert = require('assert');
const { CATEGORIES, QUESTIONS } = require('../js/questions.js');

const ids = new Set();
const perCat = {};
QUESTIONS.forEach(q => {
  const where = q.id || JSON.stringify(q.q).slice(0, 40);
  assert.ok(q.id && !ids.has(q.id), 'missing/duplicate id: ' + where); ids.add(q.id);
  assert.ok(CATEGORIES[q.cat], where + ': unknown category ' + q.cat);
  assert.ok(typeof q.q === 'string' && q.q.length > 10, where + ': question text');
  assert.ok(Array.isArray(q.options) && q.options.length === 4, where + ': needs 4 options');
  assert.strictEqual(new Set(q.options).size, 4, where + ': duplicate options');
  assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length, where + ': correct index');
  assert.ok(!/\b(all|none|both) of the (above|options)\b|\bboth [A-D] and [A-D]\b/i.test(q.options.join('|')), where + ': position-dependent option');
  assert.ok(typeof q.explain === 'string' && q.explain.length > 30, where + ': rationale');
  perCat[q.cat] = (perCat[q.cat] || 0) + 1;
});
assert.ok(QUESTIONS.length >= 200, 'expected ≥200 questions, got ' + QUESTIONS.length);
Object.keys(CATEGORIES).forEach(c => assert.ok(perCat[c] >= 10, c + ' has only ' + (perCat[c] || 0)));

// Answer positions are informational only — quiz.js shuffles options at runtime.
const pos = [0, 0, 0, 0];
QUESTIONS.forEach(q => pos[q.correct]++);
console.log(`${QUESTIONS.length} questions OK`, perCat, 'answer positions', pos);
