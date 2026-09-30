#!/usr/bin/env node
/**
 * Says what the scheduled CI run on main found, where someone will see it: a
 * red run opens the `main-red` issue (or comments on the open one) with the
 * failed rows of `.ci-local/report.md`, and a green run closes it.
 *
 *   OUTCOME=success|failure node scripts/ci/report-main.mjs
 *
 * Reads GITHUB_TOKEN (issues: write), GITHUB_API_URL, GITHUB_REPOSITORY,
 * GITHUB_SHA and RUN_URL from the workflow. A red outcome is not an exit code
 * here: the `ci:local` step already failed the run, and this is only the report.
 */
import { existsSync, readFileSync } from 'node:fs';

const LABEL = 'main-red';
const { GITHUB_TOKEN, GITHUB_API_URL, GITHUB_REPOSITORY, GITHUB_SHA, RUN_URL, OUTCOME } =
  process.env;
const api = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}`;
const headers = {
  authorization: `Bearer ${GITHUB_TOKEN}`,
  accept: 'application/vnd.github+json',
};

async function call(path, init = {}) {
  const res = await fetch(`${api}${path}`, { ...init, headers });
  if (res.status === 404 && init.allow404) return null;
  if (!res.ok)
    throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const post = (path, body) => call(path, { method: 'POST', body: JSON.stringify(body) });

/** Every open `main-red` issue, oldest first; there should be one at most. */
async function openIssues() {
  const items = await call(
    `/issues?state=open&labels=${LABEL}&sort=created&direction=asc&per_page=100`,
  );
  return items.filter((item) => !item.pull_request);
}

/** The rows of the report that failed, or a pointer to the log without one. */
function failedRows() {
  const path = '.ci-local/report.md';
  if (!existsSync(path)) return 'The run ended before `ci:local` wrote a report; see the log.';
  const lines = readFileSync(path, 'utf8').split('\n');
  const header = lines.filter((line) => line.startsWith('| Job') || line.startsWith('| ---'));
  const failed = lines.filter((line) => line.includes('❌'));
  return failed.length ? [...header, ...failed].join('\n') : 'No step failed; see the log.';
}

const sha = GITHUB_SHA.slice(0, 12);
const issues = await openIssues();

if (OUTCOME === 'success') {
  for (const issue of issues) {
    await post(`/issues/${issue.number}/comments`, {
      body: `Green again at \`${sha}\`: ${RUN_URL}`,
    });
    await call(`/issues/${issue.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
    });
  }
  console.log(
    issues.length ? `closed ${issues.map((i) => `#${i.number}`).join(', ')}` : 'main is green',
  );
} else {
  const body = [
    `CI failed on \`main\` at \`${sha}\`: ${RUN_URL}`,
    '',
    failedRows(),
    '',
    `Reproduce with \`pnpm ci:local --all\` on \`${sha}\`: it is the program this run ran.`,
  ].join('\n');
  const [issue] = issues;
  if (issue) {
    await post(`/issues/${issue.number}/comments`, { body });
    console.log(`commented on #${issue.number}`);
  } else {
    // Creating an issue with a label that does not exist fails; make it once.
    if (!(await call(`/labels/${LABEL}`, { allow404: true }))) {
      await post('/labels', {
        name: LABEL,
        color: 'b60205',
        description: 'The scheduled CI run on main is red',
      });
    }
    const created = await post('/issues', { title: 'main is red', labels: [LABEL], body });
    console.log(`opened #${created.number}`);
  }
}
