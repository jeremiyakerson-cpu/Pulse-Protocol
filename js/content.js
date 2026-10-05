/*
 * Pulse-Protocol content stamp: which version of the drug reference this is, when its data last
 * changed, and where clinical review stands. Shown in the calculator and on the home page.
 *
 * Keeping it honest: tests/content.test.js fingerprints js/drugs.js. Any change to drug data fails
 * that test until DATA_UPDATED and DATA_FINGERPRINT below are updated (and REVIEW reconsidered).
 */
(function (root) {
  'use strict';

  var CONTENT = {
    // Bump with every change to clinical content (drugs or reference text): YYYY.MM.patch
    CONTENT_VERSION: '2026.09.2',
    // Date of the last change to js/drugs.js (dose, concentration, max or source text).
    DATA_UPDATED: '2026-09-28',
    DATA_FINGERPRINT: 'cb411c2b',
    // Clinical sign-off for the current data. status: 'pending' | 'reviewed'.
    // When a clinician signs off, set status 'reviewed', date (YYYY-MM-DD) and who.
    REVIEW: { status: 'pending', date: null, by: null, note: 'Awaiting a nurse’s clinical sign-off.' }
  };

  // FNV-1a (32-bit) over the drug data as JSON — a change detector, not a security hash.
  function fingerprint(drugs) {
    var s = JSON.stringify(drugs);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  // Four-digit years written in a source string ("AHA ACLS 2020", "(2016)", "rev. 2/2026").
  function yearsIn(text, maxYear) {
    var out = [];
    String(text || '').replace(/(^|[^\d.])((?:19[5-9]|20[0-9])\d)(?![\d.])/g, function (m, pre, y) {
      var n = Number(y);
      if ((!maxYear || n <= maxYear) && out.indexOf(n) === -1) out.push(n);
      return m;
    });
    return out.sort();
  }

  /*
   * Guideline years for one drug entry, taken only from what the entry itself cites.
   *   source: years in drug.source (the reference the numbers were checked against)
   *   checked: years in drug.sourceNote (dated documents quoted in the pass-2 citation check)
   * An empty source list means the edition year is not recorded — the UI says so rather than guess.
   */
  function sourceYears(drug, maxYear) {
    return { source: yearsIn(drug.source, maxYear), checked: yearsIn(drug.sourceNote, maxYear) };
  }

  var api = {
    CONTENT_VERSION: CONTENT.CONTENT_VERSION,
    DATA_UPDATED: CONTENT.DATA_UPDATED,
    DATA_FINGERPRINT: CONTENT.DATA_FINGERPRINT,
    REVIEW: CONTENT.REVIEW,
    fingerprint: fingerprint,
    yearsIn: yearsIn,
    sourceYears: sourceYears
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.PulseContent = api;
    // Short stamp for any page element marked data-content-stamp (the home page footer).
    if (typeof document !== 'undefined') {
      var fill = function () {
        var els = document.querySelectorAll('[data-content-stamp]');
        for (var i = 0; i < els.length; i++) {
          els[i].textContent = 'Dosing content v' + api.CONTENT_VERSION + ' · data updated ' + api.DATA_UPDATED + ' · clinical review: ' +
            (api.REVIEW.status === 'reviewed' ? api.REVIEW.date : 'pending');
        }
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill);
      else fill();
    }
  }
})(typeof window !== 'undefined' ? window : this);
