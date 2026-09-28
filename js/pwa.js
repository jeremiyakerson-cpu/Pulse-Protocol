// Pulse & Protocol — service worker registration + online/offline indicator.
(function () {
  var root = document.documentElement;
  function syncOnline() { root.classList.toggle('is-offline', !navigator.onLine); }
  syncOnline();
  window.addEventListener('online', syncOnline);
  window.addEventListener('offline', syncOnline);

  if (!('serviceWorker' in navigator)) return;
  // Service workers require https (or localhost); skip on file:// previews.
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.warn('Service worker registration failed:', err);
    });
  });
})();
