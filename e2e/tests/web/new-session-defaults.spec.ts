import { expect, type Page, test } from '@playwright/test';
import { connectInstallation, pairHost, STUB_REPOSITORIES } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * A project's defaults, applied to New session however a person reaches it.
 *
 * `new-session.spec.ts` covers the one way in where the project is picked in
 * the chip. The others open the screen already on a project: the sidebar's
 * "New session in …" names it in the address, and a plain visit starts on the
 * project the last visit remembered. Each of them must start the draft on that
 * project's host, repository and agent — and a session sent from there must be
 * the one the defaults describe.
 */
test.describe('New session: project defaults', () => {
  test('applies the project defaults to the draft and the session', async ({ page }) => {
    // Pairing redeems a token at an IP-throttled route; see `pairHost`.
    test.slow();
    const owner = await provisionedUser('projdefaults');
    // Two machines, so a default host is a choice rather than the only row.
    await pairHost(owner.api, 'Other box');
    const hostId = await pairHost(owner.api, 'Default box');
    const installationId = await connectInstallation(owner.api);

    const created = await owner.api.post('/api/v1/projects', {
      data: {
        name: 'Wallet',
        repositories: [
          {
            installationId,
            githubRepoId: STUB_REPOSITORIES.web.githubRepoId,
            baseBranch: STUB_REPOSITORIES.web.defaultBranch,
            isDefault: true,
          },
        ],
        defaultHostId: hostId,
        defaultAgent: 'claude-code',
      },
      failOnStatusCode: false,
    });
    expect(created.status(), await created.text()).toBe(201);
    const projectId = ((await created.json()) as { id: string }).id;

    await signInAs(page, owner.user);

    // ── Named in the address, as "New session in …" does ─────────────────────
    await page.goto(`/sessions/new?project=${projectId}`);
    await expectDefaults(page);

    // ── Remembered from the last visit, with nothing in the address ──────────
    await page.goto('/sessions/new');
    await expectDefaults(page);

    // ── Picked away by hand, then named again from the sidebar ───────────────
    // The landing pick is its own one-shot: it must not count as the address
    // having named Wallet already, or "New session in Wallet" — which changes
    // only the search on the mounted screen — would be ignored.
    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByRole('option', { name: /Unassigned/ }).click();
    await expect(page.getByRole('button', { name: 'Project', exact: true })).toContainText(
      'Unassigned',
    );
    await page.getByRole('button', { name: 'Repositories' }).click();
    await page.getByRole('option', { name: new RegExp(STUB_REPOSITORIES.mobile.name) }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'New session in Wallet' }).first().click();
    await expect(page).toHaveURL(new RegExp(`project=${projectId}`));
    await expectDefaults(page);

    // ── Sent as it stands: the session is the one the defaults describe ─────
    await page.getByRole('textbox', { name: /Describe a task/ }).fill('tidy the wallet header');
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const sessionId = page.url().split('/').pop() as string;

    const response = await owner.api.get(`/api/v1/sessions/${sessionId}`);
    expect(response.status(), await response.text()).toBe(200);
    const session = (await response.json()) as {
      projectId: string;
      hostId: string;
      agent: string;
      checkouts: { githubRepoId: number | string; baseBranch: string }[];
    };
    expect(session.projectId).toBe(projectId);
    expect(session.hostId).toBe(hostId);
    expect(session.agent).toBe('claude-code');
    expect(session.checkouts).toHaveLength(1);
    expect(String(session.checkouts[0]?.githubRepoId)).toBe(
      String(STUB_REPOSITORIES.web.githubRepoId),
    );
    expect(session.checkouts[0]?.baseBranch).toBe(STUB_REPOSITORIES.web.defaultBranch);
  });
});

async function expectDefaults(page: Page) {
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toContainText('Wallet');
  await expect(page.getByRole('button', { name: 'Host' })).toContainText('Default box');
  await expect(page.getByRole('button', { name: 'Repositories' })).toContainText(
    STUB_REPOSITORIES.web.name,
  );
}
