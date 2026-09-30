#!/usr/bin/env node
// Fails if any file in sw.js's PRECACHE list is missing from the site folder
// (a single 404 makes the service worker install fail, which silently turns
// off offline mode). Usage: node .github/scripts/check-precache.js [siteDir]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.resolve(process.argv[2] || '.');
const code = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
const sandbox = { self: { addEventListener() {}, location: { origin: '' } } };
const { PRECACHE, PRECACHE_OPTIONAL = [] } =
  vm.runInNewContext(code + '\n;({ PRECACHE, PRECACHE_OPTIONAL: typeof PRECACHE_OPTIONAL === "undefined" ? [] : PRECACHE_OPTIONAL })', sandbox);

const exists = p => fs.existsSync(path.join(dir, p === './' ? 'index.html' : p));
const missing = PRECACHE.filter(p => !exists(p));
for (const p of PRECACHE_OPTIONAL.filter(p => !exists(p))) console.log(`note: optional precache file not present: ${p}`);
if (missing.length) {
  console.error(`Missing precached files (offline mode would break):\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(`precache OK: ${PRECACHE.length} required, ${PRECACHE_OPTIONAL.filter(exists).length}/${PRECACHE_OPTIONAL.length} optional present`);
