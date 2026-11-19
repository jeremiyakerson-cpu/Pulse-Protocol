// Release gate. Exits non-zero while any blocker is open.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/content.json'), 'utf8'));
const gates = JSON.parse(fs.readFileSync(path.join(ROOT, 'release-gates.json'), 'utf8'));
const blockers = [];
D.dosing.filter(d => !d.verified || !d.signoff).forEach(d => blockers.push(`Pharmacist sign-off missing: ${d.drug} (${d.indication})`));
Object.entries(gates).forEach(([k, g]) => { if (!g.done) blockers.push(`${g.label}: not complete`); });
if (blockers.length) {
  console.log(`RELEASE BLOCKED: ${blockers.length} open item(s)`); blockers.forEach(b => console.log('  ✗ ' + b)); process.exit(1);
}
console.log('Release gates clear.');
