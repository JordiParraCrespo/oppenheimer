// The installer runs before the runner is on the machine, so it carries its
// own copy of the runner's look (apps/runner/internal/cli/look.go). look.go
// owns it; this test fails when the installer's mark drifts from it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('the installer draws the same fedora as the runner', () => {
  const look = readFileSync(join(ROOT, 'apps/runner/internal/cli/look.go'), 'utf8');
  const declared = look.match(/var mark = \[3\]string\{(.*)\}/);
  assert.ok(declared, 'look.go no longer declares `var mark = [3]string{...}`');
  const mark = [...declared[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  assert.equal(mark.length, 3);

  const installer = readFileSync(join(ROOT, 'scripts/runner/install.sh'), 'utf8');
  const banner = installer.slice(
    installer.indexOf('banner() {'),
    installer.indexOf('\n}\n', installer.indexOf('banner() {')),
  );
  for (const row of mark) {
    assert.ok(
      banner.includes(`%s${row}%s`),
      `install.sh's banner is missing the mark's row "${row}"`,
    );
  }
});
