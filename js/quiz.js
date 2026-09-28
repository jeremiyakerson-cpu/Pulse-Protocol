/*
 * ER Study Monitor — page controller for quiz.html.
 * Data: js/questions.js (window.PulseQuestions). Progress logic: js/quizstore.js (window.PulseQuizStore).
 * Progress persists in localStorage under STORE_KEY; every storage call is wrapped so a blocked/full
 * storage never breaks the quiz.
 *
 * Modes:
 *   study — rationale is shown immediately after each answer.
 *   exam  — timed (seconds per question × questions), no feedback until the end; unanswered = incorrect.
 */
(function () {
  'use strict';

  var CATEGORIES = window.PulseQuestions.CATEGORIES;
  var QUESTIONS = window.PulseQuestions.QUESTIONS;
  var QS = window.PulseQuizStore;
  var CAT_KEYS = Object.keys(CATEGORIES);
  var BY_ID = {};
  QUESTIONS.forEach(function (q) { BY_ID[q.id] = q; });

  var STORE_KEY = 'pulseProtocol.quiz.v1';
  var LENGTHS = [10, 20, 50, 0]; // 0 = all matching questions
  var NO_ANSWER = '(no answer — time ran out)';

  // ───────── persistence ─────────

  function load() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { /* ignore */ }
    return QS.normalize(raw, Object.keys(BY_ID), CAT_KEYS);
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }

  var store = load();

  // ───────── session state ─────────

  var view = 'setup';
  var selectedCats = store.cats && store.cats.length ? store.cats.slice() : CAT_KEYS.slice();
  var length = LENGTHS.indexOf(store.length) !== -1 ? store.length : 10;
  var deck = [], idx = 0, selected = null, score = 0, streak = 0, bestStreak = 0, answered = [], reviewMode = false;
  var runMode = store.mode;          // mode of the run in progress (store.mode is the setup choice)
  var examAnswers = [];              // exam: picked option index per deck position (null = unanswered)
  var deadline = 0, timerId = null, startedAt = 0, timedOut = false;

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

  function toggleRow(options, current, onclick) {
    return '<div style="display:flex;background:#0E1A24;border:1px solid #22384A;border-radius:12px;padding:4px;">' +
      options.map(function (o) {
        var on = o.value === current;
        return '<button class="mode-btn' + (on ? ' active' : '') + '" aria-pressed="' + on + '" style="flex:1;padding:10px;border-radius:8px;border:none;cursor:pointer;font-weight:700;font-size:12px;' +
          (on ? 'background:#2FB8C6;color:#0E1A24;' : 'background:transparent;color:#8FA8B3;') +
          '" onclick="' + onclick + '(' + JSON.stringify(o.value).replace(/"/g, '&quot;') + ')">' + esc(o.label) + '</button>';
      }).join('') + '</div>';
  }

  function isExam() { return runMode === 'exam' && view === 'quiz'; }

  function updateMonitor() {
    var exam = isExam();
    // In an exam, correctness stays hidden until the end: show answered count instead of score.
    $('scoreVal').textContent = exam ? examAnswers.filter(function (a) { return a !== null; }).length : score;
    $('totalVal').textContent = '/' + deck.length;
    $('streakVal').textContent = exam ? QS.formatClock(deadline - Date.now()) : streak;
    if ($('scoreLabel')) $('scoreLabel').textContent = exam ? 'Answered' : 'Score';
    if ($('streakLabel')) $('streakLabel').textContent = exam ? 'Time left' : 'Streak';
    var pct = view === 'done' ? 100 : view === 'quiz' && deck.length ? (idx / deck.length) * 100 : 0;
    $('progressBar').style.width = pct + '%';
  }

  // ───────── timer (exam mode) ─────────

  function stopTimer() {
    if (timerId !== null) { clearInterval(timerId); timerId = null; }
  }

  function tick() {
    if (!isExam()) { stopTimer(); return; }
    if (Date.now() >= deadline) { timedOut = true; finish(); return; }
    updateMonitor();
  }

  // ───────── views ─────────

  function renderStats() {
    var rows = QS.categorySummary(store, CAT_KEYS);
    var seen = 0, correct = 0;
    rows.forEach(function (r) { seen += r.seen; correct += r.correct; });
    if (!seen) return '';
    return '<div class="explain-title" style="margin:20px 0 10px;">Your progress · ' + correct + '/' + seen +
      ' (' + Math.round((correct / seen) * 100) + '%)</div>' +
      rows.map(function (r) {
        var c = CATEGORIES[r.cat];
        return '<div class="cat-row"><div class="cat-name">' + esc(c.label) + '</div>' +
          '<div class="cat-bar-bg"><div class="cat-bar-fg" style="width:' + (r.pct || 0) + '%;background:' + c.color + ';"></div></div>' +
          '<div class="cat-frac mono" style="width:64px;">' + (r.pct === null ? '—' : r.pct + '% · ' + r.seen) + '</div></div>';
      }).join('');
  }

  function renderSetup() {
    var counts = {};
    QUESTIONS.forEach(function (q) { counts[q.cat] = (counts[q.cat] || 0) + 1; });

    var chips = CAT_KEYS.map(function (key) {
      var c = CATEGORIES[key];
      var on = selectedCats.indexOf(key) !== -1;
      var style = on
        ? 'color:' + c.color + ';background:' + c.color + '26;border:1px solid ' + c.color + ';'
        : 'color:#8FA8B3;background:transparent;border:1px solid #22384A;';
      return '<button class="cat-badge" aria-pressed="' + on + '" style="cursor:pointer;margin:0 6px 8px 0;' + style +
        '" onclick="quizToggleCat(\'' + key + '\')">' + esc(c.label) + ' · ' + counts[key] + '</button>';
    }).join('');

    var available = pool().length;
    var lengthRow = toggleRow(LENGTHS.map(function (n) {
      return { value: n, label: n === 0 ? 'All (' + available + ')' : String(n) };
    }), length, 'quizSetLength');

    var modeRow = toggleRow([
      { value: 'study', label: 'Study' },
      { value: 'exam', label: 'Timed exam' }
    ], store.mode, 'quizSetMode');

    var n = length ? Math.min(length, available) : available;
    var examRow = store.mode === 'exam'
      ? '<div class="explain-title" style="margin:14px 0 8px;">Time per question</div>' +
        toggleRow(QS.EXAM_SECS.map(function (s) { return { value: s, label: s + ' s' }; }), store.examSecs, 'quizSetExamSecs') +
        '<div style="font-size:12px;color:#8FA8B3;margin-top:8px;">' + n + ' questions · ' +
          QS.formatClock(QS.examBudgetMs(n, store.examSecs)) + ' total. Answers and rationales are revealed at the end; unanswered questions count as incorrect.</div>'
      : '<div style="font-size:12px;color:#8FA8B3;margin-top:8px;">The correct answer and rationale are shown right after each question.</div>';

    var last = store.history[store.history.length - 1];
    var lastHtml = last
      ? '<div style="font-size:12px;color:#8FA8B3;margin-top:14px;">Last session' + (last.mode === 'exam' ? ' (exam)' : '') +
        ': <span class="mono" style="color:#E8F0F2;">' + last.score + '/' + last.total + '</span> (' +
        Math.round((last.score / last.total) * 100) + '%) · ' + esc(new Date(last.t).toLocaleDateString()) + '</div>'
      : '';

    var missedCount = store.missed.length;
    var hasProgress = store.history.length || missedCount || Object.keys(store.stats).length;

    $('quizArea').innerHTML =
      '<div class="explain-title" style="margin-bottom:8px;">Mode</div>' + modeRow + examRow +
      '<div class="explain-title" style="margin:16px 0 10px;">Categories</div>' +
      '<div style="display:flex;flex-wrap:wrap;">' + chips + '</div>' +
      '<div style="display:flex;gap:8px;margin:4px 0 16px;">' +
        '<button class="btn-secondary" style="padding:8px;font-size:12px;" onclick="quizAllCats(true)">Select all</button>' +
        '<button class="btn-secondary" style="padding:8px;font-size:12px;" onclick="quizAllCats(false)">Clear</button>' +
      '</div>' +
      '<div class="explain-title" style="margin-bottom:8px;">Questions per run</div>' + lengthRow +
      '<button class="btn-primary" id="quizStartBtn" ' + (available ? '' : 'disabled style="opacity:.5;cursor:default;"') +
        ' onclick="quizStart(false)">' + (available ? (store.mode === 'exam' ? 'Start timed exam' : 'Start — randomized') : 'Pick at least one category') + '</button>' +
      (missedCount
        ? '<button class="btn-secondary" style="margin-top:10px;" onclick="quizStart(true)">Review missed questions (' + missedCount + ')</button>'
        : '') +
      lastHtml + renderStats() +
      (hasProgress
        ? '<div style="margin-top:10px;"><button onclick="quizResetProgress()" style="background:none;border:none;color:#8FA8B3;font-size:11px;text-decoration:underline;cursor:pointer;padding:0;">Reset saved progress</button></div>'
        : '');
  }

  function renderQuestion() {
    var q = deck[idx];
    var exam = runMode === 'exam';
    var pickedNow = exam ? examAnswers[idx] : selected;
    var reveal = !exam && selected !== null;

    var optsHtml = q.options.map(function (opt, i) {
      var cls = 'opt', mark = '', style = '';
      if (reveal) {
        if (i === q.correct) cls += ' correct';
        else if (i === selected) cls += ' wrong';
        else cls += ' dim';
        mark = i === q.correct ? '✓' : (i === selected ? '✕' : '');
      } else if (exam && pickedNow === i) {
        // exam: highlight the chosen option in neutral teal without saying whether it is right
        style = ' style="border-color:#2FB8C6;background:rgba(47,184,198,0.12);"';
        mark = '●';
      }
      return '<button class="' + cls + '"' + style + ' ' + (reveal ? 'disabled' : '') + ' aria-pressed="' + (pickedNow === i) + '" onclick="pick(' + i + ')"><span>' + esc(opt) + '</span><span>' + mark + '</span></button>';
    }).join('');

    var nav;
    if (exam) {
      nav = '<div style="display:flex;gap:8px;">' +
        (idx > 0 ? '<button class="btn-secondary" style="margin-top:14px;flex:1;" onclick="quizPrev()">Back</button>' : '') +
        '<button class="btn-primary" style="flex:2;" onclick="next()">' + (idx + 1 >= deck.length ? 'Submit exam' : (pickedNow === null ? 'Skip' : 'Next')) + '</button></div>';
    } else {
      nav = reveal
        ? '<div class="explain"><div class="explain-title">Rationale</div><div class="explain-body">' + esc(q.explain) + '</div></div>' +
          '<button class="btn-primary" onclick="next()">' + (idx + 1 >= deck.length ? 'See results' : 'Next case') + '</button>'
        : '';
    }

    $('quizArea').innerHTML =
      '<div class="row" style="margin-bottom:12px;">' + badge(q.cat) +
        '<span class="mono" style="font-size:12px;color:#8FA8B3;">' + (exam ? 'Exam · ' : '') + (reviewMode ? 'Review · ' : '') + 'Q' + (idx + 1) + ' / ' + deck.length + '</span></div>' +
      '<div class="qtext">' + esc(q.q) + '</div>' + optsHtml + nav +
      '<button onclick="quizQuit()" style="margin-top:12px;background:none;border:none;color:#8FA8B3;font-size:11px;text-decoration:underline;cursor:pointer;padding:0;">' +
        (exam ? 'End exam now (unanswered count as incorrect)' : 'End run') + '</button>';
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

    var examLine = runMode === 'exam'
      ? ' · ' + (timedOut ? 'time ran out' : 'finished in ' + QS.formatClock(Date.now() - startedAt))
      : ' · best streak ' + bestStreak;

    $('quizArea').innerHTML =
      '<div class="result-pct mono">' + (total ? Math.round((score / total) * 100) : 0) + '%</div>' +
      '<div class="result-sub">' + score + '/' + total + ' correct' + examLine + '</div>' +
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

  // Copy a question with its options in random order (the bank stores many answers in slot B).
  function withShuffledOptions(q) {
    var order = shuffle(q.options.map(function (_, i) { return i; }));
    return {
      id: q.id, cat: q.cat, q: q.q, explain: q.explain,
      options: order.map(function (i) { return q.options[i]; }),
      correct: order.indexOf(q.correct)
    };
  }

  function begin(questions, isReview) {
    stopTimer();
    deck = shuffle(questions).map(withShuffledOptions);
    reviewMode = isReview;
    runMode = store.mode;
    idx = 0; selected = null; score = 0; streak = 0; bestStreak = 0; answered = []; timedOut = false;
    examAnswers = deck.map(function () { return null; });
    view = deck.length ? 'quiz' : 'setup';
    startedAt = Date.now();
    if (view === 'quiz' && runMode === 'exam') {
      deadline = startedAt + QS.examBudgetMs(deck.length, store.examSecs);
      timerId = setInterval(tick, 500);
    }
    render();
  }

  // Study mode records each answer as it happens; exam mode scores everything here at the end.
  function scoreExam() {
    deck.forEach(function (q, i) {
      var p = examAnswers[i];
      var ok = p === q.correct;
      if (ok) score++;
      answered.push({ id: q.id, correct: ok, picked: p === null ? NO_ANSWER : q.options[p] });
      QS.recordAnswer(store, q.id, q.cat, ok);
    });
  }

  function finish() {
    stopTimer();
    if (runMode === 'exam' && view === 'quiz') scoreExam();
    view = 'done';
    if (answered.length) {
      QS.recordRun(store, { t: Date.now(), score: score, total: answered.length, review: reviewMode, mode: runMode });
    }
    save();
    render();
  }

  window.quizToggleCat = function (key) {
    var i = selectedCats.indexOf(key);
    if (i === -1) selectedCats.push(key); else selectedCats.splice(i, 1);
    store.cats = selectedCats.slice(); save();
    render();
  };

  window.quizAllCats = function (on) {
    selectedCats = on ? CAT_KEYS.slice() : [];
    store.cats = selectedCats.slice(); save();
    render();
  };

  window.quizSetLength = function (n) {
    length = n; store.length = n; save();
    render();
  };

  window.quizSetMode = function (m) {
    if (QS.MODES.indexOf(m) === -1) return;
    store.mode = m; save();
    render();
  };

  window.quizSetExamSecs = function (s) {
    if (QS.EXAM_SECS.indexOf(s) === -1) return;
    store.examSecs = s; save();
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
    if (!window.confirm('Clear saved missed questions, score history and category progress?')) return;
    store = QS.normalize({ cats: selectedCats.slice(), length: length, mode: store.mode, examSecs: store.examSecs }, [], CAT_KEYS);
    save();
    render();
  };

  window.pick = function (i) {
    if (view !== 'quiz') return;
    if (runMode === 'exam') {
      examAnswers[idx] = i;   // may change the answer until the exam is submitted
      render();
      return;
    }
    if (selected !== null) return;
    selected = i;
    var q = deck[idx];
    var isCorrect = i === q.correct;
    if (isCorrect) { score++; streak++; bestStreak = Math.max(bestStreak, streak); }
    else { streak = 0; }
    answered.push({ id: q.id, correct: isCorrect, picked: q.options[i] });
    QS.recordAnswer(store, q.id, q.cat, isCorrect);
    save();
    render();
  };

  window.next = function () {
    if (idx + 1 >= deck.length) { finish(); return; }
    idx++; selected = null; render();
  };

  window.quizPrev = function () {
    if (runMode === 'exam' && idx > 0) { idx--; render(); }
  };

  window.restart = function () {
    stopTimer();
    view = 'setup'; deck = []; score = 0; streak = 0; render();
  };

  render();
})();
