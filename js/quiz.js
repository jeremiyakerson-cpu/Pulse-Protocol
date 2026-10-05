/*
 * ER Study Monitor — page controller for quiz.html.
 * Data: js/questions.js (window.PulseQuestions). Progress logic: js/quizstore.js (window.PulseQuizStore);
 * scheduler and mastery model: js/srs.js (window.PulseSRS).
 * Progress persists in localStorage under STORE_KEY (schema 2; an older schema-1 store is migrated on load).
 * Every storage call is wrapped so a blocked/full storage never breaks the quiz.
 *
 * Modes:
 *   study    — rationale is shown immediately after each answer.
 *   adaptive — spaced repetition: due and weak questions first, then new ones; a missed question comes back
 *              once later in the same session. Feedback as in study mode.
 *   exam     — timed (seconds per question × questions), no feedback until the end; unanswered = incorrect.
 * In study and adaptive modes an optional confidence rating (guessed / unsure / sure) is asked after picking
 * an answer and before it is revealed; it feeds the scheduler.
 */
(function () {
  'use strict';

  var CATEGORIES = window.PulseQuestions.CATEGORIES;
  var QUESTIONS = window.PulseQuestions.QUESTIONS;
  var QS = window.PulseQuizStore;
  var SRS = window.PulseSRS;
  var CAT_KEYS = Object.keys(CATEGORIES);
  var BY_ID = {};
  QUESTIONS.forEach(function (q) { BY_ID[q.id] = q; });

  var STORE_KEY = QS.KEYS[QS.SCHEMA];
  var REQUEUE_GAP = 4;           // adaptive: a missed question returns this many questions later
  var REQUEUE_SHARE = 0.25;      // adaptive: at most this share of the session is re-queued misses
  var LENGTHS = [10, 20, 50, 0]; // 0 = all matching questions
  var NO_ANSWER = '(no answer — time ran out)';

  // ───────── persistence ─────────

  function load() {
    var found = QS.readStored(function (k) {
      try { return localStorage.getItem(k); } catch (e) { return null; }
    });
    var s = QS.normalize(found.raw, Object.keys(BY_ID), CAT_KEYS);
    if (found.from && found.from < QS.SCHEMA) {
      // Write the migrated copy under the new key; the old key stays as it was.
      try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
    }
    return s;
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
  var confPending = false;           // study/adaptive: answer picked, waiting for the confidence rating
  var requeued = {};                 // adaptive: ids already re-queued this session
  var requeueLeft = 0;               // adaptive: re-queues still allowed this session
  var progressMsg = '';              // progress view: result of the last export/import
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

  function link(label, onclick) {
    return '<button class="link-btn" onclick="' + onclick + '">' + esc(label) + '</button>';
  }

  function pct(x) { return Math.round(x * 100); }

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
      { value: 'adaptive', label: 'Adaptive' },
      { value: 'exam', label: 'Timed exam' }
    ], store.mode, 'quizSetMode');

    var adaptive = store.mode === 'adaptive';
    var n = length ? Math.min(length, available) : available;
    var plan = adaptive ? SRS.buildSession(store.items, pool(), store.perf, { now: Date.now(), size: store.sessionSize }) : null;
    var examRow = adaptive
      ? '<div class="explain-title" style="margin:14px 0 8px;">Questions per session</div>' +
        toggleRow(QS.SESSION_SIZES.map(function (k) { return { value: k, label: String(k) }; }), store.sessionSize, 'quizSetSessionSize') +
        '<div class="note">' + planLine(plan) + '</div>'
      : store.mode === 'exam'
      ? '<div class="explain-title" style="margin:14px 0 8px;">Time per question</div>' +
        toggleRow(QS.EXAM_SECS.map(function (s) { return { value: s, label: s + ' s' }; }), store.examSecs, 'quizSetExamSecs') +
        '<div style="font-size:12px;color:#8FA8B3;margin-top:8px;">' + n + ' questions · ' +
          QS.formatClock(QS.examBudgetMs(n, store.examSecs)) + ' total. Answers and rationales are revealed at the end; unanswered questions count as incorrect.</div>'
      : '<div style="font-size:12px;color:#8FA8B3;margin-top:8px;">The correct answer and rationale are shown right after each question.</div>';
    var confRow = store.mode !== 'exam'
      ? '<label class="check-row"><input type="checkbox" ' + (store.askConf ? 'checked ' : '') +
        'onchange="quizSetAskConf(this.checked)"> Rate my confidence before each answer is revealed</label>'
      : '';

    var last = store.history[store.history.length - 1];
    var lastHtml = last
      ? '<div style="font-size:12px;color:#8FA8B3;margin-top:14px;">Last session' + (last.mode === 'exam' ? ' (exam)' : '') +
        ': <span class="mono" style="color:#E8F0F2;">' + last.score + '/' + last.total + '</span> (' +
        Math.round((last.score / last.total) * 100) + '%) · ' + esc(new Date(last.t).toLocaleDateString()) + '</div>'
      : '';

    var missedCount = store.missed.length;
    var hasProgress = store.history.length || missedCount || Object.keys(store.stats).length;

    $('quizArea').innerHTML =
      todayStrip() +
      '<div class="explain-title" style="margin-bottom:8px;">Mode</div>' + modeRow + examRow + confRow +
      '<div class="explain-title" style="margin:16px 0 10px;">Categories</div>' +
      '<div style="display:flex;flex-wrap:wrap;">' + chips + '</div>' +
      '<div style="display:flex;gap:8px;margin:4px 0 16px;">' +
        '<button class="btn-secondary" style="padding:8px;font-size:12px;" onclick="quizAllCats(true)">Select all</button>' +
        '<button class="btn-secondary" style="padding:8px;font-size:12px;" onclick="quizAllCats(false)">Clear</button>' +
      '</div>' +
      (adaptive ? '' : '<div class="explain-title" style="margin-bottom:8px;">Questions per run</div>' + lengthRow) +
      '<button class="btn-primary" id="quizStartBtn" ' + (available ? '' : 'disabled style="opacity:.5;cursor:default;"') +
        ' onclick="quizStart(false)">' + (available ? (store.mode === 'exam' ? 'Start timed exam' : adaptive ? 'Start adaptive session (' + plan.questions.length + ')' : 'Start — randomized') : 'Pick at least one category') + '</button>' +
      '<button class="btn-secondary" style="margin-top:10px;" onclick="quizShowProgress()">Progress, daily plan &amp; backup</button>' +
      (missedCount
        ? '<button class="btn-secondary" style="margin-top:10px;" onclick="quizStart(true)">Review missed questions (' + missedCount + ')</button>'
        : '') +
      lastHtml + renderStats() +
      (hasProgress
        ? '<div style="margin-top:10px;"><button onclick="quizResetProgress()" style="background:none;border:none;color:#8FA8B3;font-size:11px;text-decoration:underline;cursor:pointer;padding:0;">Reset saved progress</button></div>'
        : '');
  }

  // "5 due · 3 weak · 6 new — level Steady"
  function planLine(plan) {
    if (!plan.questions.length) return 'No questions in the selected categories.';
    var c = plan.counts, parts = [];
    if (c.due) parts.push(c.due + ' due');
    if (c.weak) parts.push(c.weak + ' weak');
    if (c.new) parts.push(c.new + ' new');
    if (c.early) parts.push(c.early + ' early review');
    return 'This session: ' + parts.join(' · ') + '. Level: <strong>' + SRS.LEVELS[plan.level].label + '</strong> — ' +
      ({ ease: 'recent answers were shaky, so fewer new questions and more consolidation.',
         steady: 'a balanced mix of review and new questions.',
         stretch: 'recent answers were strong, so more new questions from your weakest categories.' })[plan.level];
  }

  // Due count and day streak above the setup form, once there is something to show.
  function todayStrip() {
    var now = Date.now();
    var due = QUESTIONS.filter(function (q) { return SRS.isDue(store.items[q.id], now); }).length;
    var days = SRS.currentStreak(store.streak, now);
    if (!due && !days) return '';
    return '<div class="today-strip"><span><strong class="mono">' + due + '</strong> due today</span>' +
      '<span><strong class="mono">' + days + '</strong> day streak</span>' + link('Progress', 'quizShowProgress()') + '</div>';
  }

  function renderProgress() {
    var now = Date.now();
    var rows = SRS.categoryMastery(store.items, QUESTIONS, CAT_KEYS, now);
    var seen = 0, due = 0;
    rows.forEach(function (r) { seen += r.seen; due += r.due; });
    var days = SRS.currentStreak(store.streak, now);
    var p = pool();
    var plan = SRS.suggestDaily(store.items, p, store.perf, now);
    var allCats = selectedCats.length === CAT_KEYS.length;

    var tiles = '<div class="stat-grid">' +
      '<div class="stat-tile"><div class="stat-num mono">' + days + '</div><div class="label">Day streak</div>' +
        '<div class="stat-sub">best ' + store.streak.best + '</div></div>' +
      '<div class="stat-tile"><div class="stat-num mono">' + due + '</div><div class="label">Due today</div>' +
        '<div class="stat-sub">of ' + seen + ' studied</div></div>' +
      '<div class="stat-tile"><div class="stat-num mono">' + Math.round((seen / QUESTIONS.length) * 100) + '%</div><div class="label">Covered</div>' +
        '<div class="stat-sub">' + seen + '/' + QUESTIONS.length + '</div></div></div>';

    var daily = p.length
      ? '<div class="plan"><div class="explain-title">Suggested daily session</div>' +
        '<div class="plan-size"><span class="mono">' + plan.size + '</span> questions · about ' + plan.minutes + ' min</div>' +
        '<div class="note">' + [plan.due ? plan.due + ' due' : '', plan.weak ? Math.min(plan.weak, 5) + ' weak' : '', plan.newCount ? plan.newCount + ' new' : '']
          .filter(Boolean).join(' · ') + (plan.due || plan.weak || plan.newCount ? '' : 'Early review of your least-mastered questions') +
          ' · level ' + SRS.LEVELS[plan.level].label + (allCats ? '' : ' · selected categories only') + '</div>' +
        '<button class="btn-primary" onclick="quizStartDaily()">Start today\'s session</button></div>'
      : '<div class="plan note">Pick at least one category on the quiz screen to get a daily plan.</div>';

    var bars = rows.map(function (r) {
      var c = CATEGORIES[r.cat];
      return '<div class="cat-row"><div class="cat-name">' + esc(c.label) + '</div>' +
        '<div class="cat-bar-bg" role="img" aria-label="' + esc(c.label) + ' mastery ' + pct(r.mastery) + '%"><div class="cat-bar-fg" style="width:' + pct(r.mastery) + '%;background:' + c.color + ';"></div></div>' +
        '<div class="cat-frac mono mastery-frac">' + pct(r.mastery) + '%<span>' + r.seen + '/' + r.total + (r.due ? ' · ' + r.due + ' due' : '') + '</span></div></div>';
    }).join('');

    var weakest = QUESTIONS.filter(function (q) { return store.items[q.id]; })
      .map(function (q) { return { q: q, m: SRS.mastery(store.items[q.id], now) }; })
      .filter(function (x) { return x.m < SRS.WEAK; })
      .sort(function (a, b) { return a.m - b.m; })
      .slice(0, 5);
    var weakHtml = weakest.length
      ? '<div class="explain-title" style="margin:20px 0 10px;">Weakest questions</div>' +
        weakest.map(function (x) {
          return '<div class="weak-item"><div class="weak-head">' + badge(x.q.cat) + '<span class="mono">' + pct(x.m) + '%</span></div>' +
            '<div class="weak-q">' + esc(x.q.q) + '</div></div>';
        }).join('')
      : '';

    $('quizArea').innerHTML =
      '<div class="row" style="margin-bottom:14px;"><div class="explain-title" style="margin:0;">Your progress</div>' +
        link('← Back to quiz', 'restart()') + '</div>' +
      tiles + daily +
      '<div class="explain-title" style="margin:20px 0 4px;">Mastery by category</div>' +
      '<div class="note" style="margin:0 0 10px;">Mastery blends accuracy (recent answers count most), how long ago you reviewed, and your confidence. Unseen questions count as 0.</div>' +
      bars + weakHtml +
      '<div class="explain-title" style="margin:20px 0 8px;">Move to another device</div>' +
      '<div class="note" style="margin:0 0 10px;">Export saves a progress file. Import it on the other device to replace the progress there.</div>' +
      '<div class="btn-pair"><button class="btn-secondary" onclick="quizExport()">Export progress</button>' +
        '<button class="btn-secondary" onclick="document.getElementById(\'quizImportFile\').click()">Import progress</button></div>' +
      '<input type="file" id="quizImportFile" accept="application/json,.json" hidden onchange="quizImport(this)">' +
      '<div class="msg" role="status" aria-live="polite">' + esc(progressMsg) + '</div>';
  }

  function renderQuestion() {
    var q = deck[idx];
    var exam = runMode === 'exam';
    var pickedNow = exam ? examAnswers[idx] : selected;
    var reveal = !exam && selected !== null && !confPending;

    var optsHtml = q.options.map(function (opt, i) {
      var cls = 'opt', mark = '', style = '';
      if (reveal) {
        if (i === q.correct) cls += ' correct';
        else if (i === selected) cls += ' wrong';
        else cls += ' dim';
        mark = i === q.correct ? '✓' : (i === selected ? '✕' : '');
      } else if ((exam || confPending) && pickedNow === i) {
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
    } else if (confPending) {
      nav = '<div class="conf"><div class="explain-title">How sure are you?</div><div class="conf-row">' +
        [1, 2, 3].map(function (c) {
          return '<button class="conf-btn conf-' + c + '" onclick="quizConf(' + c + ')">' + SRS.CONF[c] + '</button>';
        }).join('') + '</div>' + link('Skip rating', 'quizConf(null)') + '</div>';
    } else {
      nav = reveal
        ? '<div class="explain"><div class="explain-title">Rationale</div><div class="explain-body">' + esc(q.explain) + '</div></div>' +
          '<button class="btn-primary" onclick="next()">' + (idx + 1 >= deck.length ? 'See results' : 'Next case') + '</button>'
        : '';
    }

    $('quizArea').innerHTML =
      '<div class="row" style="margin-bottom:12px;">' + badge(q.cat) +
        '<span class="mono" style="font-size:12px;color:#8FA8B3;">' + (exam ? 'Exam · ' : '') + (reviewMode ? 'Review · ' : '') + (runMode === 'adaptive' ? 'Adaptive · ' : '') + 'Q' + (idx + 1) + ' / ' + deck.length + '</span></div>' +
      (q.requeued ? '<div class="note" style="margin-top:0;">Missed earlier this session — try it again.</div>' : '') +
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
    var adaptiveHtml = '';
    if (runMode === 'adaptive') {
      var now = Date.now();
      var dueLeft = QUESTIONS.filter(function (q) { return SRS.isDue(store.items[q.id], now); }).length;
      adaptiveHtml = '<div class="note" style="text-align:center;margin:-12px 0 18px;">' +
        (dueLeft ? dueLeft + ' still due today' : 'Nothing left due today') + ' · day streak ' + SRS.currentStreak(store.streak, now) +
        ' · ' + link('See progress', 'quizShowProgress()') + '</div>';
    }

    $('quizArea').innerHTML =
      '<div class="result-pct mono">' + (total ? Math.round((score / total) * 100) : 0) + '%</div>' +
      '<div class="result-sub">' + score + '/' + total + ' correct' + examLine + '</div>' +
      adaptiveHtml + catHtml + missHtml +
      (misses.length ? '<button class="btn-primary" onclick="quizRetryRun()">Retry the ' + misses.length + ' missed</button>' : '') +
      '<button class="btn-secondary" style="margin-top:10px;" onclick="restart()">New quiz</button>';
  }

  function render() {
    updateMonitor();
    if (view === 'setup') renderSetup();
    else if (view === 'progress') renderProgress();
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

  // ordered: keep the given order (adaptive sessions are already prioritised).
  function begin(questions, isReview, ordered) {
    stopTimer();
    deck = (ordered ? questions : shuffle(questions)).map(withShuffledOptions);
    reviewMode = isReview;
    runMode = store.mode === 'adaptive' && isReview ? 'study' : store.mode;
    idx = 0; selected = null; score = 0; streak = 0; bestStreak = 0; answered = []; timedOut = false;
    confPending = false; requeued = {}; requeueLeft = Math.ceil(deck.length * REQUEUE_SHARE);
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
    if (store.mode === 'adaptive') {
      startAdaptive(store.sessionSize);
      return;
    }
    var qs = shuffle(pool());
    begin(length ? qs.slice(0, length) : qs, false);
  };

  function startAdaptive(size) {
    var plan = SRS.buildSession(store.items, pool(), store.perf, { now: Date.now(), size: size });
    begin(plan.questions, false, true);
  }

  window.quizStartDaily = function () {
    var plan = SRS.suggestDaily(store.items, pool(), store.perf, Date.now());
    store.mode = 'adaptive'; save();
    startAdaptive(plan.size);
  };

  window.quizShowProgress = function () {
    stopTimer();
    progressMsg = '';
    view = 'progress'; deck = []; score = 0; streak = 0; render();
    window.scrollTo(0, 0);
  };

  window.quizSetSessionSize = function (k) {
    if (QS.SESSION_SIZES.indexOf(k) === -1) return;
    store.sessionSize = k; save();
    render();
  };

  window.quizSetAskConf = function (on) {
    store.askConf = !!on; save();
  };

  window.quizExport = function () {
    var json = JSON.stringify(QS.exportData(store), null, 1);
    var d = new Date();
    var name = 'pulse-progress-' + d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + '.json';
    try {
      var url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      progressMsg = 'Saved ' + name + '.';
    } catch (e) {
      progressMsg = 'Export failed on this browser.';
    }
    render();
  };

  window.quizImport = function (input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var next;
      try { next = QS.importData(String(reader.result), Object.keys(BY_ID), CAT_KEYS); }
      catch (e) { progressMsg = 'Import failed: ' + e.message; render(); return; }
      var n = Object.keys(next.items).length;
      if (!window.confirm('Replace the progress on this device with ' + file.name + ' (' + n + ' questions studied)?')) {
        progressMsg = 'Import cancelled.'; render(); return;
      }
      store = next;
      selectedCats = store.cats && store.cats.length ? store.cats.slice() : CAT_KEYS.slice();
      length = LENGTHS.indexOf(store.length) !== -1 ? store.length : 10;
      save();
      progressMsg = 'Imported ' + file.name + '.';
      render();
    };
    reader.onerror = function () { progressMsg = 'Could not read that file.'; render(); };
    reader.readAsText(file);
  };

  window.quizConf = function (c) {
    if (view !== 'quiz' || !confPending) return;
    confPending = false;
    answer(c);
  };

  window.quizRetryRun = function () {
    begin(answered.filter(function (a) { return !a.correct; }).map(function (a) { return BY_ID[a.id]; }), true);
  };

  window.quizQuit = function () { finish(); };

  window.quizResetProgress = function () {
    if (!window.confirm('Clear saved missed questions, score history and category progress?')) return;
    store = QS.normalize({ schema: QS.SCHEMA, cats: selectedCats.slice(), length: length, mode: store.mode, examSecs: store.examSecs,
      askConf: store.askConf, sessionSize: store.sessionSize }, [], CAT_KEYS);
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
    if (selected !== null && !confPending) return;
    selected = i;
    if (store.askConf) {           // hold the answer until it is rated (picking again changes it)
      confPending = true;
      render();
      return;
    }
    answer(null);
  };

  // Score and record the picked answer (study/adaptive), then reveal the rationale.
  function answer(conf) {
    var q = deck[idx];
    var isCorrect = selected === q.correct;
    if (isCorrect) { score++; streak++; bestStreak = Math.max(bestStreak, streak); }
    else { streak = 0; }
    answered.push({ id: q.id, correct: isCorrect, picked: q.options[selected] });
    QS.recordAnswer(store, q.id, q.cat, isCorrect, conf);
    if (!isCorrect && runMode === 'adaptive' && !requeued[q.id] && requeueLeft > 0) {
      // Bring a missed question back once, a few questions later.
      requeued[q.id] = true;
      requeueLeft--;
      var again = withShuffledOptions(BY_ID[q.id]);
      again.requeued = true;
      deck.splice(Math.min(deck.length, idx + 1 + REQUEUE_GAP), 0, again);
    }
    save();
    render();
  }

  window.next = function () {
    if (idx + 1 >= deck.length) { finish(); return; }
    idx++; selected = null; confPending = false; render();
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
