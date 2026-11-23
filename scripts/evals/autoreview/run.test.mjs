/**
 * The grader and the fixture check, without an agent. A grader that passes a
 * review naming the wrong defect, or one on the wrong file, would report the
 * brief as catching bugs it does not.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { grade, loadCases, parseReview, summarise, validateCases } from './run.mjs';

const { cases } = loadCases();
const byId = (id) => cases.find((c) => c.id === id);
const file = 'apps/api/src/automations/domain/routine-payload-excerpt.policy.ts';
const answer = (findings) =>
  `Reviewed.\n\n\`\`\`json\n${JSON.stringify({ verdict: 'FINDINGS', findings })}\n\`\`\``;

test('every case in cases.json is a valid fixture', () => {
  assert.deepEqual(validateCases(cases), []);
});

test('a planted case passes only on a P0/P1 finding, on its file, that names the defect', () => {
  const planted = byId('surrogate-cut');
  const hit = {
    priority: 'P1',
    file,
    summary: 'slice can split a surrogate pair; jsonb refuses it',
  };
  assert.equal(grade(planted, parseReview(answer([hit]))).pass, true);
  assert.equal(grade(planted, parseReview(answer([{ ...hit, priority: 'P2' }]))).pass, false);
  assert.equal(
    grade(planted, parseReview(answer([{ ...hit, file: 'apps/api/src/other.ts' }]))).pass,
    false,
  );
  assert.equal(
    grade(planted, parseReview(answer([{ ...hit, summary: 'the cap is too small' }]))).pass,
    false,
  );
  // A path the reviewer writes from its worktree still counts.
  assert.equal(
    grade(planted, parseReview(answer([{ ...hit, file: `/tmp/wt/${file}` }]))).pass,
    true,
  );
});

test('a decoy passes with no P0/P1 on its files, and fails with one', () => {
  const decoy = byId('surrogate-cut-ok');
  assert.equal(grade(decoy, parseReview(answer([]))).pass, true);
  assert.equal(
    grade(decoy, parseReview(answer([{ priority: 'P2', file, summary: 'x' }]))).pass,
    true,
  );
  assert.equal(
    grade(decoy, parseReview(answer([{ priority: 'P1', file, summary: 'x' }]))).pass,
    false,
  );
});

test('an answer with no JSON block is unparsed, never a pass', () => {
  assert.deepEqual(grade(byId('surrogate-cut-ok'), parseReview('CLEAN')), {
    parsed: false,
    pass: false,
  });
});

test('a case that overwrites a repository file, or expects a file it does not add, is refused', () => {
  const problems = validateCases([byId('surrogate-cut')], { exists: () => true });
  assert.ok(problems.some((p) => p.includes('already exists in the repository')));
  const wrong = {
    ...byId('surrogate-cut'),
    expect: { files: ['apps/api/src/nope.ts'], match: 'x' },
  };
  assert.ok(validateCases([wrong]).some((p) => p.includes('which it does not add')));
});

test('the summary counts planted and decoy cases apart', () => {
  const entries = [
    { decoy: false, grade: { parsed: true, pass: true }, agent: { cost_usd: 1 } },
    { decoy: false, grade: { parsed: true, pass: false }, agent: { cost_usd: 1 } },
    { decoy: true, grade: { parsed: true, pass: true }, agent: { cost_usd: 0.5 } },
  ];
  assert.deepEqual(summarise(entries), {
    caught: '1/2',
    decoysClean: '1/1',
    unparsed: 0,
    cost_usd: 2.5,
  });
});
