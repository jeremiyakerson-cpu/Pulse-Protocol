// Pulse & Protocol — light/dark theme.
// Loaded synchronously in <head> so the right theme is applied before first
// paint. The effective theme is always written to <html data-theme>: the
// visitor's saved choice if they made one, otherwise the system preference.
(function () {
  var KEY = 'pulse-theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  var THEME_COLOR = { dark: '#0E1A24', light: '#F4F7F8' };

  function saved() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; }
    catch (e) { return null; }
  }
  function store(v) {
    try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {}
  }
  function system() { return media && media.matches ? 'light' : 'dark'; }
  function current() { return saved() || system(); }

  function apply() {
    var theme = current();
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      var next = theme === 'dark' ? 'light' : 'dark';
      btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
      btn.title = 'Switch to ' + next + ' theme';
      btn.textContent = theme === 'dark' ? '☀︎' : '☾︎'; // ☀ / ☾ (text presentation)
    }
  }

  function toggle() {
    var next = current() === 'dark' ? 'light' : 'dark';
    // Picking the system theme clears the override, so the site keeps
    // following the OS (e.g. automatic dark mode at night).
    store(next === system() ? null : next);
    apply();
  }

  apply();
  if (media) {
    var onChange = function () { if (!saved()) apply(); };
    if (media.addEventListener) media.addEventListener('change', onChange);
    else if (media.addListener) media.addListener(onChange);
  }
  // Keep other open tabs in sync.
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });

  document.addEventListener('DOMContentLoaded', function () {
    var links = document.querySelector('.site-nav .nav-links');
    if (!links) return;
    var li = document.createElement('li');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.addEventListener('click', toggle);
    li.appendChild(btn);
    links.appendChild(li);
    apply();
  });
})();
