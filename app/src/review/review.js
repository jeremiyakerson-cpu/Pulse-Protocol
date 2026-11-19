// Clinical review checklist. Decisions live in the artifact's shared db
// (collection "reviews", one doc per item) so Claude can read them back.
(function () {
  'use strict';
  var D = window.PP_DATA;
  var $ = function (id) { return document.getElementById(id); };
  function h(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // FNV-1a fingerprint of an item's content: an approval goes stale when content changes.
  function fp(obj) {
    var s = JSON.stringify(obj), x = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
    return ('0000000' + x.toString(16)).slice(-8);
  }

  // ---------- items ----------
  var items = [];
  D.cases.forEach(function (c) {
    c.stages.forEach(function (s, i) {
      items.push({ key: 'case--' + c.id + '--' + i, group: 'cases', c: c, s: s, i: i, hash: fp({ v: c.vignette, vit: c.vitals, s: s, f: c.flags }),
        title: c.title + ' · stage ' + (i + 1) + ' of ' + c.stages.length });
    });
  });
  D.index.forEach(function (e) { items.push({ key: 'index--' + e.id, group: 'index', e: e, hash: fp(e), title: e.title }); });
  D.dosing.forEach(function (d) {
    var core = {}; Object.keys(d).forEach(function (k) { if (k !== 'verified' && k !== 'signoff' && k !== 'provenance') core[k] = d[k]; });
    items.push({ key: 'dose--' + d.id, group: 'dosing', d: d, hash: fp(core), title: d.drug + ' · ' + d.indication });
  });
  var GROUPS = [['cases', 'Answer keys'], ['index', 'Index'], ['dosing', 'Dosing']];

  // ---------- state ----------
  var decisions = {}, db = null, user = null, myId = null, names = {};
  var group = 'cases', filter = 'all';
  function state(it) {
    var d = decisions[it.key];
    if (!d || !d.status) return 'pending';
    if (d.hash !== it.hash) return 'stale';
    return d.status;
  }

  // ---------- content rendering ----------
  function body(it) {
    if (it.group === 'cases') {
      var c = it.c, s = it.s, html = '';
      html += '<p class="rv-ctx">' + h(c.patient) + ' · ' + (c.kind === 'deterioration' ? 'Deterioration' : 'Urgent care') + ' · ' + h(c.section) + '</p>';
      if (it.i === 0) html += '<p class="rv-ctx">' + h(c.vignette) + '</p>';
      if (s.update) html += '<p class="rv-ctx"><b>New findings:</b> ' + h(s.update) + '</p>';
      html += '<p class="rv-q">' + h(s.prompt) + '</p><ul class="rv-opts">' + s.options.map(function (o) {
        return '<li class="' + (o.ok ? 'ok' : '') + '"><div class="rv-opt-t">' + (o.ok ? '<em>Key</em>' : '') + '<span>' + h(o.t) + '</span></div><div class="rv-opt-w">' + h(o.why) + '</div></li>';
      }).join('') + '</ul>';
      html += '<p class="rv-take"><b>Takeaway.</b> ' + h(s.takeaway) + '</p>';
      if (it.i === c.stages.length - 1) html += c.flags.map(function (f) { return '<p class="rv-flag">⚠︎ ' + h(f) + '</p>'; }).join('');
      return html;
    }
    if (it.group === 'index') {
      var e = it.e;
      var list = function (t, xs) { return xs.length ? '<div class="rv-sub">' + t + '</div><ul class="dot-list">' + xs.map(function (x) { return '<li>' + h(x) + '</li>'; }).join('') + '</ul>' : ''; };
      return '<p class="rv-ctx">' + (e.kind === 'card' ? 'Descriptive reference card' : 'Topic') + ' · ' + h(e.category) + '</p>' +
        '<p class="rv-ctx" style="color:var(--text-soft)">' + h(e.summary) + '</p>' +
        list(e.kind === 'card' ? 'Criteria' : 'Assess', e.assess) + list(e.kind === 'card' ? 'How to use it' : 'Nursing interventions', e.interventions) +
        list('Pitfalls', e.pitfalls) + e.flags.map(function (f) { return '<p class="rv-flag">⚠︎ ' + h(f) + '</p>'; }).join('');
    }
    var d = it.d;
    var rows = [['Dose', d.per_kg + ' ' + d.unit + '/kg'], ['Max single dose', d.max_dose + ' ' + d.unit], ['Route', d.route], ['Concentration', d.conc_label || '—'],
      ['Repeat', d.repeat], ['Min weight', d.min_kg ? d.min_kg + ' kg' : '—'], ['Age notes', d.age_note || '—'], ['Notes', d.notes || '—'], ['Source', d.source]];
    return '<p class="rv-ctx">' + h(d.provenance) + '</p><div class="table-wrap"><table class="table"><tbody>' +
      rows.map(function (r) { return '<tr><th scope="row">' + h(r[0]) + '</th><td>' + h(r[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  function card(it) {
    var st = state(it);
    return '<article class="card rv-item" id="it-' + it.key + '" data-state="' + st + '">' +
      '<div class="eyebrow">' + (it.group === 'cases' ? h(it.s.label) : it.group === 'index' ? 'Index entry' : 'Dosing entry') + '</div>' +
      '<h3>' + h(it.title) + '</h3>' + body(it) +
      '<div class="rv-actions" data-key="' + it.key + '">' +
      '<div class="rv-btns"><button type="button" class="btn btn-ghost btn-approve" data-act="approved">Approve</button>' +
      '<button type="button" class="btn btn-ghost btn-flag" data-act="flagged">Flag</button></div>' +
      '<label class="visually-hidden" for="note-' + it.key + '">Note for ' + h(it.title) + '</label>' +
      '<textarea class="input rv-note" id="note-' + it.key + '" placeholder="What needs to change? (optional for approvals)"></textarea>' +
      '<div class="rv-meta"><span class="rv-who"></span><button type="button" class="btn btn-ghost" data-act="note">Save note</button></div></div></article>';
  }

  function paintActions(it) {
    var el = document.querySelector('.rv-actions[data-key="' + it.key + '"]');
    if (!el) return;
    var st = state(it), d = decisions[it.key];
    el.parentNode.setAttribute('data-state', st);
    el.querySelectorAll('[data-act="approved"],[data-act="flagged"]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(d && d.status === b.getAttribute('data-act') && st !== 'stale'));
      b.disabled = !db;
    });
    el.querySelector('[data-act="note"]').disabled = !db;
    var ta = el.querySelector('textarea');
    if (document.activeElement !== ta && !ta.dataset.dirty) ta.value = (d && d.note) || '';
    ta.disabled = !db;
    var who = el.querySelector('.rv-who');
    if (st === 'stale') who.innerHTML = '<span class="rv-stale">Content changed since this was ' + h(d.status) + '. Review again.</span>';
    else if (d && d.status) {
      var nm = d.by === myId ? 'you' : ((names[d.by] && names[d.by].name) || 'a reviewer');
      who.textContent = (d.status === 'approved' ? 'Approved' : 'Flagged') + ' by ' + nm + (d.at ? ' · ' + new Date(d.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
    } else who.textContent = 'Not reviewed yet';
  }

  // ---------- summary + list ----------
  function counts(list) {
    var n = { approved: 0, flagged: 0, stale: 0, pending: 0 };
    list.forEach(function (it) { n[state(it)]++; });
    return n;
  }
  function renderSummary() {
    var all = counts(items);
    var html = '<div class="row"><div><div class="label">Approved</div><span class="big-num">' + all.approved + '</span><span class="big-unit">/ ' + items.length + '</span></div>' +
      '<div style="text-align:right"><div class="label">Flagged</div><span class="big-num" style="font-size:28px;color:' + (all.flagged ? 'var(--red)' : 'var(--text)') + '">' + all.flagged + '</span></div></div><div class="rv-bars" style="margin-top:14px">';
    GROUPS.forEach(function (g) {
      var list = items.filter(function (it) { return it.group === g[0]; }), n = counts(list), t = list.length;
      var pct = function (x) { return (x / t * 100).toFixed(2) + '%'; };
      html += '<div><div class="rv-bar-top"><span>' + g[1] + '</span><span>' + n.approved + ' of ' + t + ' approved</span></div>' +
        '<div class="rv-track" aria-hidden="true"><i class="a" style="width:' + pct(n.approved) + '"></i><i class="f" style="width:' + pct(n.flagged) + '"></i><i class="s" style="width:' + pct(n.stale) + '"></i></div></div>';
    });
    html += '</div><div class="rv-legend"><span><b style="background:var(--green)"></b>Approved</span><span><b style="background:var(--red)"></b>Flagged</span><span><b style="background:var(--amber)"></b>Changed, review again</span><span><b style="background:var(--bg);border:1px solid var(--border)"></b>Not reviewed</span></div>';
    $('rv-summary').innerHTML = html;
  }
  function seg(el, opts, cur, onPick, attr) {
    el.innerHTML = opts.map(function (o) { return '<button type="button" ' + attr + '="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + o[1] + '</button>'; }).join('');
    el.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { onPick(b.getAttribute(attr)); }); });
  }
  function renderControls() {
    seg($('rv-group'), GROUPS, group, function (v) { group = v; renderControls(); renderList(); }, 'data-g');
    seg($('rv-filter'), [['all', 'All'], ['todo', 'To review'], ['flagged', 'Flagged'], ['approved', 'Approved']], filter,
      function (v) { filter = v; renderControls(); renderList(); }, 'data-f');
  }
  function renderList() {
    var list = items.filter(function (it) {
      if (it.group !== group) return false;
      var st = state(it);
      return filter === 'all' || (filter === 'todo' && (st === 'pending' || st === 'stale')) || st === filter;
    });
    $('rv-list').innerHTML = list.length ? list.map(card).join('') : '<div class="card-dashed rv-empty">Nothing here for this filter.</div>';
    list.forEach(paintActions);
  }

  // ---------- writes ----------
  function save(key, status) {
    var it = items.filter(function (x) { return x.key === key; })[0];
    var el = document.querySelector('.rv-actions[data-key="' + key + '"]');
    var ta = el.querySelector('textarea'), prev = decisions[key] || {};
    var doc = { status: status || prev.status || null, note: ta.value.trim(), hash: status ? it.hash : (prev.hash || null),
      by: myId, at: Date.now(), group: it.group, title: it.title };
    if (!status && !prev.status) doc.status = null;
    if (status === 'flagged' && !doc.note) { ta.focus(); setStatus('Add a note saying what needs to change, then press Flag again.', true); return; }
    var who = el.querySelector('.rv-who'); who.innerHTML = '<span class="rv-saving">Saving…</span>';
    db.collection('reviews').doc(key).set(doc).then(function () {
      delete ta.dataset.dirty; decisions[key] = doc; paintActions(it); renderSummary(); setStatus(statusLine());
    }).catch(function (e) {
      var msg = e && e.code === 'quota_exceeded' ? 'Storage is full for this page.' : e && e.code === 'unavailable' ? 'Connection dropped. Try again in a moment.' : 'Could not save. You may only have view access to this page.';
      setStatus(msg, true); paintActions(it);
    });
  }
  $('rv-list').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b || !db) return;
    var key = b.closest('.rv-actions').getAttribute('data-key'), act = b.getAttribute('data-act');
    save(key, act === 'note' ? null : act);
  });
  $('rv-list').addEventListener('input', function (ev) { if (ev.target.tagName === 'TEXTAREA') ev.target.dataset.dirty = '1'; });

  function setStatus(msg, warn) { var s = $('rv-status'); s.textContent = msg; s.className = 'rv-status' + (warn ? ' warn' : ''); }
  function statusLine() { var n = counts(items); return 'Saved decisions load live. ' + (n.pending + n.stale) + ' items still to review.'; }

  // ---------- boot ----------
  renderControls(); renderSummary(); renderList();
  var claude = window.claude;
  if (!claude || !claude.use) { setStatus('Read-only copy: open this page on claude.ai to save decisions.', true); return; }
  var timer = setTimeout(function () { setStatus('Saved decisions are taking a while to load. You can keep reading.', true); }, 10000);
  Promise.all([claude.use('db'), claude.use('user')]).then(function (r) {
    db = r[0]; user = r[1];
    if (!db) { clearTimeout(timer); setStatus('Saving is unavailable here. Sign in to claude.ai to record decisions.', true); renderList(); return; }
    return (user ? user.id() : Promise.resolve(null)).then(function (id) {
      myId = id;
      db.collection('reviews').onSnapshot(function (snap) {
        clearTimeout(timer);
        decisions = {}; snap.docs.forEach(function (d) { decisions[d.id] = d.data(); });
        var ids = Object.keys(decisions).map(function (k) { return decisions[k].by; }).filter(function (x, i, a) { return x && x !== myId && a.indexOf(x) === i; });
        var after = function () { renderSummary(); items.forEach(paintActions); setStatus(statusLine()); };
        if (user && ids.length) user.profiles(ids).then(function (p) { names = p || {}; after(); }); else after();
      }, function (e) {
        clearTimeout(timer);
        setStatus(e && e.code === 'revoked' ? 'Access to saved decisions ended.' : 'Could not load saved decisions. Reload the page to try again.', true);
      });
    });
  });
})();
