import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { attach, pairedHosts } from '../../support/fleet';
import {
  connectInstallation,
  STUB_BRANCH,
  STUB_REPOSITORIES,
  waitForLifecycle,
} from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * Review in a session, from a pull request's page to a real runner: one press
 * on the host the console picked starts Claude Code in a worktree of the pull
 * request's head branch, with the review prompt as its first task, and opens
 * the session. The stub's #14 is `fix/wallet-empty-state` on `xrp-mobile`,
 * which the fleet's git server also carries; the `claude` shim prints the argv
 * it was started with. Needs the console on `WEB_URL`.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ baseURL: WEB_URL });

test('a pull request opens a review session on its head branch', async ({ page }) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleetreview');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'review');

  await signInAs(page, user);
  await page.goto(`/pulls/${installationId}/${STUB_REPOSITORIES.mobile.githubRepoId}/14`);
  await expect(page.getByRole('heading', { name: 'How to test' })).toBeVisible({
    timeout: 30_000,
  });
  // Where it runs is on the bar: the one online host, picked for the reader.
  await expect(page.getByRole('button', { name: 'Host', exact: true })).toContainText(
    box.host.name,
  );
  await page.getByRole('button', { name: 'Review in a session' }).click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const sessionId = page.url().split('/').pop() as string;
  await waitForLifecycle(api, sessionId, 'open');

  const session = (await (await api.get(`/api/v1/sessions/${sessionId}`)).json()) as {
    agent: string;
    hostId: string;
    checkouts: { baseBranch: string }[];
  };
  expect(session).toMatchObject({ agent: 'claude-code', hostId: box.id });
  expect(session.checkouts[0]?.baseBranch).toBe(STUB_BRANCH);

  // Claude Code starts on the review prompt, edits approved, in the worktree
  // of the head branch.
  const terminal = await attach(api, sessionId);
  const screen = await terminal.waitFor('CLAUDE-SHIM argv=', 120_000);
  expect(screen).toContain('--permission-mode acceptEdits');
  expect(screen).toContain('Help me review pull request #14 in acme-labs/xrp-mobile');
  // The typed line holds `$((1+1))`, never the `2`, so only the answer matches.
  terminal.send(
    `git merge-base --is-ancestor origin/${STUB_BRANCH} HEAD && echo HEAD-OF-$((1+1))\r`,
  );
  await terminal.waitFor('HEAD-OF-2', 30_000);
  await terminal.close();
});
