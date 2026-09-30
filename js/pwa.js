// Pulse & Protocol — service worker registration, update notice, install
// prompt and online/offline indicator.
(function () {
  var root = document.documentElement;
  function syncOnline() { root.classList.toggle('is-offline', !navigator.onLine); }
  syncOnline();
  window.addEventListener('online', syncOnline);
  window.addEventListener('offline', syncOnline);

  // ---- Toast ----
  var toast;
  function showToast(message, action, autoHideMs) {
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.innerHTML = '<span class="toast-msg"></span><button type="button" class="toast-btn"></button>' +
        '<button type="button" class="toast-close" aria-label="Dismiss">×</button>';
      toast.querySelector('.toast-close').addEventListener('click', function () { toast.hidden = true; });
      document.body.appendChild(toast);
    }
    toast.querySelector('.toast-msg').textContent = message;
    var btn = toast.querySelector('.toast-btn');
    btn.hidden = !action;
    if (action) {
      btn.textContent = action.label;
      btn.onclick = action.run;
    }
    toast.hidden = false;
    clearTimeout(toast._timer);
    if (autoHideMs) toast._timer = setTimeout(function () { toast.hidden = true; }, autoHideMs);
  }

  // ---- Install prompt ----
  // Any element with [data-install] is revealed once the browser says the app
  // can be installed, and triggers the native prompt when clicked. Elements with
  // [data-install-hide-standalone] are hidden when already running as the app.
  var deferredPrompt = null;
  function standalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function syncInstall() {
    var els = document.querySelectorAll('[data-install]');
    for (var i = 0; i < els.length; i++) els[i].hidden = !deferredPrompt;
    if (standalone()) {
      var s = document.querySelectorAll('[data-install-hide-standalone]');
      for (var j = 0; j < s.length; j++) s[j].hidden = true;
    }
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    syncInstall();
  });
  window.addEventListener('appinstalled', function () { deferredPrompt = null; syncInstall(); });
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-install]');
    if (!el || !deferredPrompt) return;
    var p = deferredPrompt;
    deferredPrompt = null;
    p.prompt();
    (p.userChoice || Promise.resolve()).then(syncInstall, syncInstall);
  });
  document.addEventListener('DOMContentLoaded', syncInstall);

  if (!('serviceWorker' in navigator)) return;
  // Service workers require https (or localhost); skip on file:// previews.
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  // sw.js activates new versions immediately (skipWaiting + clients.claim).
  // When that happens under an open page, the page is still running the old
  // HTML/CSS/JS, so offer a reload instead of silently mixing versions (and
  // instead of auto-reloading, which would throw away a quiz in progress).
  var hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (hadController) {
      showToast('A new version of Pulse & Protocol is ready.', {
        label: 'Reload',
        run: function () { location.reload(); }
      });
    } else {
      hadController = true;
      showToast('Saved for offline use — works with no signal.', null, 5000);
    }
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      // A PWA can stay open for a whole shift; re-check for updates when it
      // comes back to the foreground (at most once an hour).
      var last = Date.now();
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - last > 3600e3) {
          last = Date.now();
          reg.update().catch(function () {});
        }
      });
    }).catch(function (err) {
      console.warn('Service worker registration failed:', err);
    });
  });
})();
