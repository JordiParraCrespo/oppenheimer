/**
 * A product note that changes without the brief or the decision list fails
 * the branch, unless a commit says why neither moves.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productSyncProblems } from './check-product-sync.mjs';

const note = 'product/versions/mvp/25-bots.md';

test('a branch that touches no note has nothing to sync', () => {
  assert.deepEqual(productSyncProblems({ changed: ['apps/api/x.ts'], messages: [''] }), []);
});

test('a note changed alone is out of sync with both the brief and the decision list', () => {
  const [problem] = productSyncProblems({ changed: [note], messages: ['feat: x'] });
  assert.match(problem, /product\/brief\.html and product\/README\.md did not/);
});

test('a note changed with the brief but not the decision list names the list', () => {
  const [problem] = productSyncProblems({
    changed: [note, 'product/brief.html'],
    messages: ['feat: x'],
  });
  assert.match(problem, /product\/README\.md did not/);
  assert.doesNotMatch(problem, /brief\.html and/);
});

test('a note changed with both is in sync', () => {
  assert.deepEqual(
    productSyncProblems({
      changed: [note, 'product/brief.html', 'product/README.md'],
      messages: [''],
    }),
    [],
  );
});

test('the next steps and the top-level notes count; research does not', () => {
  for (const path of ['product/next-steps/answering-on-telegram.md', 'product/15-review.md']) {
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
});
