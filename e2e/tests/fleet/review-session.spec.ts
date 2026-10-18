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
 * A pull request's review session, from its Chat tab to a real runner: one
 * press on the host the console picked starts Claude Code in a worktree of
 * the head branch, with the review prompt as its first task, and the tab
 * shows its terminal. The session is listed under For review and never under
 * Sessions. The stub's #14 is `fix/wallet-empty-state` on `xrp-mobile`,
 * which the fleet's git server also carries; the `claude` shim prints the
 * argv it was started with, then hands the pane to a shell. The pane has no
 * input row of its own: the agent's prompt in the grid is the only one. Needs
 * the console on `WEB_URL`.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ baseURL: WEB_URL });

test('a pull request’s Chat tab starts a review session on its head branch', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(page).toHaveURL(/view=chat/);
  // Where it runs: the one online host, picked for the reader.
  await expect(page.getByRole('button', { name: 'Host', exact: true })).toContainText(
    box.host.name,
  );
  await page.getByRole('button', { name: 'Start review session' }).click();

  // The tab becomes the session: its bar names the pull request and its branch.
  await expect(page.getByText('review · xrp-mobile #14')).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/pulls\/.+view=chat/);

  const reviews = (await (await api.get('/api/v1/pulls/review-sessions')).json()) as {
    sessionId: string;
    number: number;
    headRef: string;
    hostId: string;
  }[];
  expect(reviews).toHaveLength(1);
  expect(reviews[0]).toMatchObject({ number: 14, headRef: STUB_BRANCH, hostId: box.id });
  const sessionId = reviews[0]?.sessionId as string;
  await waitForLifecycle(api, sessionId, 'open');

  // A review session is the Pull requests area's: Sessions does not list it.
  const sessions = (await (await api.get('/api/v1/sessions')).json()) as {
    data: { id: string }[];
  };
  expect(sessions.data.map((row) => row.id)).not.toContain(sessionId);
  await expect(
    page.getByRole('listitem').filter({ hasText: '#14 Fix the empty state' }),
  ).toBeVisible();

  // Claude Code starts on the review prompt, in auto mode, in the worktree
  // of the head branch.
  const terminal = await attach(api, sessionId);
  const screen = await terminal.waitFor('CLAUDE-SHIM argv=', 120_000);
  expect(screen).toContain('--permission-mode auto');
  expect(screen).toContain('Help me review pull request #14 in acme-labs/xrp-mobile');
  // The typed line holds `$((1+1))`, never the `2`, so only the answer matches.
  terminal.send(
    `git merge-base --is-ancestor origin/${STUB_BRANCH} HEAD && echo HEAD-OF-$((1+1))\r`,
  );
  await terminal.waitFor('HEAD-OF-2', 30_000);
  await terminal.close();
});
