import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';

// Compile the real TypeScript helper with the project's installed compiler.
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'petlify-dates-'));
after(() => rmSync(directory, { recursive: true, force: true }));
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
  join(root, 'src/lib/dates.ts'), '--target', 'ES2020', '--module', 'commonjs',
  '--skipLibCheck', '--outDir', directory]);

const cases = {
  'UTC purchase displays at 09h in the shop':
    `assert.match(d.formatDateTime('2026-10-02T12:00:00Z'), /09:00/);`,
  'editing agenda and vaccine preserves local wall time':
    `assert.equal(d.toDateTimeInput('2026-10-02T09:00:00-03:00'), '2026-10-02T09:00');
     assert.equal(d.toDateTimeInput('2026-10-02T12:00:00Z'), '2026-10-02T09:00');`,
  'shop day can differ from UTC day':
    `assert.equal(d.formatDate('2026-10-02T02:30:00Z'), '01/10/2026');`,
  'today filter uses shop day near midnight':
    `const now = new Date('2026-10-02T02:30:00Z');
     assert.equal(d.isToday('2026-10-01T21:00:00-03:00', now), true);
     assert.equal(d.isToday('2026-10-02T01:00:00-03:00', now), false);`,
  'revenue month uses shop month at its boundary':
    `assert.equal(d.monthKey('2026-11-01T02:59:59Z'), '2026-10');
     assert.equal(d.monthKey('2026-11-01T03:00:00Z'), '2026-11');`,
  'ambiguous API timestamps are rejected':
    `assert.throws(() => d.formatDateTime('2026-10-02T09:00'), RangeError);`,
  'selected slot is displayed as shop input without parsing a device date':
    `assert.equal(d.formatShopInput('2026-10-03T08:00'), '03/10/2026, 08:00');
     assert.throws(() => d.formatShopInput('2026-10-03T11:00:00Z'), RangeError);`,
};

for (const timezone of ['UTC', 'Asia/Tokyo']) {
  for (const [name, assertions] of Object.entries(cases)) {
    test(`${name} (device: ${timezone})`, () => {
      execFileSync(process.execPath, ['-e', `
        const assert = require('node:assert/strict');
        const d = require(process.env.PETLIFY_DATE_TEST_MODULE);
        ${assertions}
      `], { env: { ...process.env, TZ: timezone,
        PETLIFY_DATE_TEST_MODULE: join(directory, 'dates.js') } });
    });
  }
}
