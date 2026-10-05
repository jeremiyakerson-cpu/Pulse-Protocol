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

  // ---- Update banner ----
  // A new sw.js installs in the background and then waits (see sw.js). This
  // banner offers the reload; it is never automatic, so a quiz or a dose
  // calculation in progress is not thrown away. "Later" hides it for this page
  // view only — it comes back on the next page load while an update waits.
  var banner;
  function showUpdateBanner(onReload, text) {
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'update-banner';
      banner.setAttribute('role', 'status');
      banner.innerHTML = '<div class="update-banner-inner"><span class="update-banner-msg"></span>' +
        '<button type="button" class="update-banner-btn">Reload</button>' +
        '<button type="button" class="update-banner-later">Later</button></div>';
      banner.querySelector('.update-banner-later').addEventListener('click', function () { banner.hidden = true; });
      var nav = document.querySelector('.site-nav');
      if (nav && nav.parentNode) nav.parentNode.insertBefore(banner, nav.nextSibling);
      else document.body.insertBefore(banner, document.body.firstChild);
    }
    banner.querySelector('.update-banner-msg').textContent = text || 'New version available — reload to update.';
    var btn = banner.querySelector('.update-banner-btn');
    btn.disabled = false;
    btn.onclick = function () { btn.disabled = true; onReload(); };
    banner.hidden = false;
  }

  var reloadRequested = false;
  var hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloadRequested) { location.reload(); return; }
    if (hadController) {
      // Another tab applied the update; this page still runs the old files.
      showUpdateBanner(function () { location.reload(); }, 'Pulse & Protocol was updated — reload to use the new version.');
    } else {
      hadController = true;
      showToast('Saved for offline use — works with no signal.', null, 5000);
    }
  });

  function offerUpdate(worker) {
    // No controller means this is the first install, not an update.
    if (!worker || !navigator.serviceWorker.controller) return;
    showUpdateBanner(function () {
      reloadRequested = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
      // If the new worker already took over (e.g. from another tab) there is no controllerchange left to wait for.
      setTimeout(function () { if (worker.state === 'activated' || worker.state === 'redundant') location.reload(); }, 3000);
    });
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      if (reg.waiting) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed') offerUpdate(worker);
        });
      });

      // A PWA can stay open for a whole shift; re-check for updates when it
      // comes back to the foreground or back online (at most once an hour).
      var last = Date.now();
      function maybeCheck() {
        if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - last > 3600e3) {
          last = Date.now();
          reg.update().catch(function () {});
        }
      }
      document.addEventListener('visibilitychange', maybeCheck);
      window.addEventListener('online', maybeCheck);
      setInterval(maybeCheck, 15 * 60e3);
    }).catch(function (err) {
      console.warn('Service worker registration failed:', err);
    });
  });
})();
