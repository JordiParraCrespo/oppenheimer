/**
 * A product note that changes without the brief or the decision list fails
 * the branch, unless a commit says why neither moves.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productSyncProblems } from './check-product-sync.mjs';

const note = 'product/design/bots/25-bots.md';

test('a branch that touches no note has nothing to sync', () => {
  assert.deepEqual(productSyncProblems({ changed: ['apps/api/x.ts'], messages: [''] }), []);
});

test('a note changed alone is out of sync with both the brief and the decision list', () => {
  const [problem] = productSyncProblems({ changed: [note], messages: ['feat: x'] });
  assert.match(problem, /product\/brief\.html and product\/decisions\.md did not/);
});

test('a note changed with the brief but not the decision list names the list', () => {
  const [problem] = productSyncProblems({
    changed: [note, 'product/brief.html'],
    messages: ['feat: x'],
  });
  assert.match(problem, /product\/decisions\.md did not/);
  assert.doesNotMatch(problem, /brief\.html and/);
});

test('a note changed with both is in sync', () => {
  assert.deepEqual(
    productSyncProblems({
      changed: [note, 'product/brief.html', 'product/decisions.md'],
      messages: [''],
    }),
    [],
  );
});

test('the design, the roadmap and the archive count; research does not', () => {
  for (const path of ['product/roadmap.md', 'product/archive/07-mvp.md']) {
    assert.equal(productSyncProblems({ changed: [path], messages: [''] }).length, 1, path);
  }
  assert.deepEqual(
    productSyncProblems({ changed: ['product/research/lessons.md'], messages: [''] }),
    [],
  );
});

test('a Product-Sync trailer with a reason excuses the branch; an empty one does not', () => {
  const excused = 'docs(product): fix a link\n\nProduct-Sync: a link fix; no decision changes\n';
  assert.deepEqual(productSyncProblems({ changed: [note], messages: [excused] }), []);
  assert.equal(
    productSyncProblems({ changed: [note], messages: ['docs: x\n\nProduct-Sync:\n'] }).length,
    1,
  );
  // The empty trailer is not rescued by the line after it.
  const followed = 'docs: x\n\nProduct-Sync:\nCo-Authored-By: Claude <noreply@anthropic.com>\n';
  assert.equal(productSyncProblems({ changed: [note], messages: [followed] }).length, 1);
});
