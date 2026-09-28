/*
 * ER Study Monitor — page controller for quiz.html.
 * Data: js/questions.js (window.PulseQuestions).
 * Progress (missed questions + recent scores) persists in localStorage under STORE_KEY.
 */
(function () {
  'use strict';

  var CATEGORIES = window.PulseQuestions.CATEGORIES;
  var QUESTIONS = window.PulseQuestions.QUESTIONS;
  var BY_ID = {};
  QUESTIONS.forEach(function (q) { BY_ID[q.id] = q; });

  var STORE_KEY = 'pulseProtocol.quiz.v1';
  var LENGTHS = [10, 20, 0]; // 0 = all matching questions

  // ───────── persistence (never let storage failures break the quiz) ─────────

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && Array.isArray(s.missed) && Array.isArray(s.history)) {
        s.missed = s.missed.filter(function (id) { return BY_ID[id]; });
        return s;
      }
    } catch (e) { /* ignore */ }
    return { missed: [], history: [], cats: null, length: 10 };
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }

  var store = load();

  // ───────── session state ─────────

  var view = 'setup';
  var selectedCats = store.cats && store.cats.length ? store.cats.slice() : Object.keys(CATEGORIES);
  var length = LENGTHS.indexOf(store.length) !== -1 ? store.length : 10;
  var deck = [], idx = 0, selected = null, score = 0, streak = 0, bestStreak = 0, answered = [], reviewMode = false;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pool() {
    return QUESTIONS.filter(function (q) { return selectedCats.indexOf(q.cat) !== -1; });
  }

  function badge(cat) {
    var c = CATEGORIES[cat];
    return '<span class="cat-badge" style="color:' + c.color + ';background:' + c.color + '1A;border:1px solid ' + c.color + '55;">' + esc(c.label) + '</span>';
  }

  function updateMonitor() {
    $('scoreVal').textContent = score;
    $('totalVal').textContent = '/' + deck.length;
    $('streakVal').textContent = streak;
    var pct = view === 'done' ? 100 : view === 'quiz' && deck.length ? (idx / deck.length) * 100 : 0;
    $('progressBar').style.width = pct + '%';
  }

  // ───────── views ─────────

  function renderSetup() {
    var counts = {};
    QUESTIONS.forEach(function (q) { counts[q.cat] = (counts[q.cat] || 0) + 1; });

    var chips = Object.keys(CATEGORIES).map(function (key) {
      var c = CATEGORIES[key];
      var on = selectedCats.indexOf(key) !== -1;
      var style = on
        ? 'color:' + c.color + ';background:' + c.color + '26;border:1px solid ' + c.color + ';'
        : 'color:#8FA8B3;background:transparent;border:1px solid #22384A;';
      return '<button class="cat-badge" aria-pressed="' + on + '" style="cursor:pointer;margin:0 6px 8px 0;' + style +
        '" onclick="quizToggleCat(\'' + key + '\')">' + esc(c.label) + ' · ' + counts[key] + '</button>';
    }).join('');

    var available = pool().length;
    var lengthBtns = LENGTHS.map(function (n) {
      var label = n === 0 ? 'All (' + available + ')' : String(n);
      return '<button class="mode-btn' + (length === n ? ' active' : '') + '" style="flex:1;padding:10px;border-radius:8px;border:none;cursor:pointer;font-weight:700;font-size:12px;' +
        (length === n ? 'background:#2FB8C6;color:#0E1A24;' : 'background:transparent;color:#8FA8B3;') +
        '" onclick="quizSetLength(' + n + ')">' + label + '</button>';
    }).join('');

    var last = store.history[store.history.length - 1];
    var lastHtml = last
      ? '<div style="font-size:12px;color:#8FA8B3;margin-top:14px;">Last session: <span class="mono" style="color:#E8F0F2;">' +
        last.score + '/' + last.total + '</span> (' + Math.round((last.score / last.total) * 100) + '%) · ' +
        esc(new Date(last.t).toLocaleDateString()) + '</div>'
      : '';

    var missedCount = store.missed.length;

    $('quizArea').innerHTML =
      '<div class="explain-title" style="margin-bottom:10px;">Categories</div>' +
      '<div style="display:flex;flex-wrap:wrap;">' + chips + '</div>' +
      '<div style="display:flex;gap:8px;margin:4px 0 16px;">' +
        '<button class="btn-secondary" style="padding:8px;font-size:12px;" onclick="quizAllCats(true)">Select all</button>' +
        '<button class="btn-secondary" style="padding:8px;font-size:12px;" onclick="quizAllCats(false)">Clear</button>' +
      '</div>' +
      '<div class="explain-title" style="margin-bottom:8px;">Questions per run</div>' +
      '<div style="display:flex;background:#0E1A24;border:1px solid #22384A;border-radius:12px;padding:4px;">' + lengthBtns + '</div>' +
      '<button class="btn-primary" ' + (available ? '' : 'disabled style="opacity:.5;cursor:default;"') +
        ' onclick="quizStart(false)">' + (available ? 'Start — randomized' : 'Pick at least one category') + '</button>' +
      (missedCount
        ? '<button class="btn-secondary" style="margin-top:10px;" onclick="quizStart(true)">Review missed questions (' + missedCount + ')</button>'
        : '') +
      lastHtml +
      (store.history.length || missedCount
        ? '<div style="margin-top:10px;"><button onclick="quizResetProgress()" style="background:none;border:none;color:#8FA8B3;font-size:11px;text-decoration:underline;cursor:pointer;padding:0;">Reset saved progress</button></div>'
        : '');
  }

  function renderQuestion() {
    var q = deck[idx];
    var optsHtml = q.options.map(function (opt, i) {
      var cls = 'opt';
      if (selected !== null) {
        if (i === q.correct) cls += ' correct';
        else if (i === selected) cls += ' wrong';
        else cls += ' dim';
      }
      var mark = selected !== null && i === q.correct ? '✓' : (selected !== null && i === selected ? '✕' : '');
      return '<button class="' + cls + '" ' + (selected !== null ? 'disabled' : '') + ' onclick="pick(' + i + ')"><span>' + esc(opt) + '</span><span>' + mark + '</span></button>';
    }).join('');

    $('quizArea').innerHTML =
      '<div class="row" style="margin-bottom:12px;">' + badge(q.cat) +
        '<span class="mono" style="font-size:12px;color:#8FA8B3;">' + (reviewMode ? 'Review · ' : '') + 'Q' + (idx + 1) + ' / ' + deck.length + '</span></div>' +
      '<div class="qtext">' + esc(q.q) + '</div>' + optsHtml +
      (selected !== null
        ? '<div class="explain"><div class="explain-title">Rationale</div><div class="explain-body">' + esc(q.explain) + '</div></div>' +
          '<button class="btn-primary" onclick="next()">' + (idx + 1 >= deck.length ? 'See results' : 'Next case') + '</button>'
        : '') +
      '<button onclick="quizQuit()" style="margin-top:12px;background:none;border:none;color:#8FA8B3;font-size:11px;text-decoration:underline;cursor:pointer;padding:0;">End run</button>';
  }

  function renderDone() {
    var total = answered.length;
    var catMap = {};
    answered.forEach(function (a) {
      var q = BY_ID[a.id];
      if (!catMap[q.cat]) catMap[q.cat] = { total: 0, correct: 0 };
      catMap[q.cat].total++;
      if (a.correct) catMap[q.cat].correct++;
    });
    var catHtml = Object.keys(catMap).map(function (cat) {
      var d = catMap[cat], c = CATEGORIES[cat];
      return '<div class="cat-row"><div class="cat-name">' + esc(c.label) + '</div>' +
        '<div class="cat-bar-bg"><div class="cat-bar-fg" style="width:' + (d.correct / d.total) * 100 + '%;background:' + c.color + ';"></div></div>' +
        '<div class="cat-frac mono">' + d.correct + '/' + d.total + '</div></div>';
    }).join('');

    var misses = answered.filter(function (a) { return !a.correct; });
    var missHtml = misses.length
      ? '<div class="explain-title" style="margin:20px 0 10px;">Missed question review (' + misses.length + ')</div>' +
        misses.map(function (a) {
          var q = BY_ID[a.id];
          return '<div class="explain" style="margin-top:10px;">' +
            '<div style="margin-bottom:8px;">' + badge(q.cat) + '</div>' +
            '<div style="font-size:13px;line-height:1.5;margin-bottom:8px;">' + esc(q.q) + '</div>' +
            '<div style="font-size:12px;color:#E5533D;margin-bottom:4px;">✕ Your answer: ' + esc(a.picked) + '</div>' +
            '<div style="font-size:12px;color:#35D07F;margin-bottom:8px;">✓ Correct: ' + esc(q.options[q.correct]) + '</div>' +
            '<div class="explain-body">' + esc(q.explain) + '</div></div>';
        }).join('')
      : '<div class="result-sub" style="margin-top:16px;">No misses — nice work.</div>';

    $('quizArea').innerHTML =
      '<div class="result-pct mono">' + (total ? Math.round((score / total) * 100) : 0) + '%</div>' +
      '<div class="result-sub">' + score + '/' + total + ' correct · best streak ' + bestStreak + '</div>' +
      catHtml + missHtml +
      (misses.length ? '<button class="btn-primary" onclick="quizRetryRun()">Retry the ' + misses.length + ' missed</button>' : '') +
      '<button class="btn-secondary" style="margin-top:10px;" onclick="restart()">New quiz</button>';
  }

  function render() {
    updateMonitor();
    if (view === 'setup') renderSetup();
    else if (view === 'done') renderDone();
    else renderQuestion();
  }

  // ───────── actions ─────────

  // Copy a question with its options in random order (the bank stores most answers in slot B).
  function withShuffledOptions(q) {
    var order = shuffle(q.options.map(function (_, i) { return i; }));
    return {
      id: q.id, cat: q.cat, q: q.q, explain: q.explain,
      options: order.map(function (i) { return q.options[i]; }),
      correct: order.indexOf(q.correct)
    };
  }

  function begin(questions, isReview) {
    deck = shuffle(questions).map(withShuffledOptions);
    reviewMode = isReview;
    idx = 0; selected = null; score = 0; streak = 0; bestStreak = 0; answered = [];
    view = deck.length ? 'quiz' : 'setup';
    render();
  }

  function finish() {
    view = 'done';
    if (answered.length) {
      store.history.push({ t: Date.now(), score: score, total: answered.length, review: reviewMode });
      if (store.history.length > 20) store.history = store.history.slice(-20);
      save();
    }
    render();
  }

  window.quizToggleCat = function (key) {
    var i = selectedCats.indexOf(key);
    if (i === -1) selectedCats.push(key); else selectedCats.splice(i, 1);
    store.cats = selectedCats.slice(); save();
    render();
  };

  window.quizAllCats = function (on) {
    selectedCats = on ? Object.keys(CATEGORIES) : [];
    store.cats = selectedCats.slice(); save();
    render();
  };

  window.quizSetLength = function (n) {
    length = n; store.length = n; save();
    render();
  };

  window.quizStart = function (review) {
    if (review) {
      begin(store.missed.map(function (id) { return BY_ID[id]; }), true);
      return;
    }
    var qs = shuffle(pool());
    begin(length ? qs.slice(0, length) : qs, false);
  };

  window.quizRetryRun = function () {
    begin(answered.filter(function (a) { return !a.correct; }).map(function (a) { return BY_ID[a.id]; }), true);
  };

  window.quizQuit = function () { finish(); };

  window.quizResetProgress = function () {
    if (!window.confirm('Clear saved missed questions and score history?')) return;
    store = { missed: [], history: [], cats: selectedCats.slice(), length: length };
    save();
    render();
  };

  window.pick = function (i) {
    if (selected !== null) return;
    selected = i;
    var q = deck[idx];
    var isCorrect = i === q.correct;
    if (isCorrect) { score++; streak++; bestStreak = Math.max(bestStreak, streak); }
    else { streak = 0; }
    answered.push({ id: q.id, correct: isCorrect, picked: q.options[i] });

    // Missed list: add on a miss, clear once answered correctly.
    var m = store.missed.indexOf(q.id);
    if (!isCorrect && m === -1) store.missed.push(q.id);
    if (isCorrect && m !== -1) store.missed.splice(m, 1);
    save();
    render();
  };

  window.next = function () {
    if (idx + 1 >= deck.length) { finish(); return; }
    idx++; selected = null; render();
  };

  window.restart = function () {
    view = 'setup'; deck = []; score = 0; streak = 0; render();
  };

  render();
})();
