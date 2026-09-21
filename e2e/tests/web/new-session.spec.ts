import { expect, test } from '@playwright/test';
import {
  connectInstallation,
  pairHost,
  STUB_BRANCH,
  STUB_REPOSITORIES,
} from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * New session, in a browser, against the real control plane.
 *
 * What this covers that nothing else can: the screen's four pickers are bound
 * to three live reads and one write, and a session created here is a row the
 * API actually holds — with the launch options the foot row was set to, the
 * first task in its log, and a name derived from that task.
 *
 * The only thing faked in the run is **GitHub**, which answers repositories and
 * branches live through an App this deployment does not have
 * (`support/github-stub.ts`). The browser, the console, the API's guards, its
 * Zod pipe and its Postgres are all the real ones.
 *
 * The run needs the stack up and the API pointed at the stub — see
 * `e2e/README.md`. Without a host or an installation the screen renders its own
 * empty state instead, which is a different spec's subject, so these skip
 * rather than fail on a deployment that cannot pair one.
 */
test.describe('New session', () => {
  test('starts a session with the scope, the foot row and the first task', async ({ page }) => {
    const owner = await provisionedUser('newsession');
    const hostId = await pairHost(owner.api, 'E2E box');
    await connectInstallation(owner.api);

    await signInAs(page, owner.user);
    await page.goto('/sessions/new');

    await expect(page.getByRole('heading', { name: 'New session' })).toBeVisible();

    // ── The host chip ────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Host' }).click();
    await page.getByRole('option', { name: /E2E box/ }).click();
    await expect(page.getByRole('button', { name: 'Host' })).toContainText('E2E box');

    // ── The repository chip, and the branch pane inside it ───────────────────
    await page.getByRole('button', { name: 'Repositories' }).click();
    await page.getByRole('option', { name: new RegExp(STUB_REPOSITORIES.mobile.name) }).click();
    // A selected row grows the cell that opens its own branch pane. Picking a
    // branch there is what makes the base something other than the default.
    await page.getByRole('button', { name: 'Change branch' }).click();
    await page.getByRole('option', { name: STUB_BRANCH }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Repositories' })).toContainText(
      STUB_REPOSITORIES.mobile.name,
    );

    // ── The foot row: what the agent may do, and how hard it thinks ──────────
    await page.getByRole('button', { name: 'Permission level' }).click();
    await page.getByRole('menuitemradio', { name: /Approve for me/ }).click();
    await expect(page.getByRole('button', { name: 'Permission level' })).toContainText(
      'Approve for me',
    );

    // ── The first task ───────────────────────────────────────────────────────
    const task = 'fix the wallet list empty state on mobile';
    await page.getByRole('textbox', { name: /Describe a task/ }).fill(task);
    await page.getByRole('button', { name: /send/i }).click();

    // The pane the session opens in is its own URL.
    await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const sessionId = page.url().split('/').pop() as string;

    // ── What the control plane actually holds ────────────────────────────────
    const read = await owner.api.get(`/api/v1/sessions/${sessionId}`, { failOnStatusCode: false });
    expect(read.status(), await read.text()).toBe(200);
    const session = (await read.json()) as {
      slug: string;
      name: string;
      agent: string;
      lifecycle: string;
      launch: { model: string | null; permission: string; effort: string | null };
      checkouts: { repositoryFullName: string; baseBranch: string; branch: string }[];
      hostId: string;
    };

    expect(session.hostId).toBe(hostId);
    expect(session.agent).toBe('claude-code');
    expect(session.launch.permission, 'the foot row is what was sent').toBe('auto');
    expect(session.launch.model, 'the engine button carries a model').toBeTruthy();
    expect(session.lifecycle, 'nothing has built a worktree yet').toBe('starting');

    // The branch chosen in the pane is the **base**; the session works on its own.
    const [checkout] = session.checkouts;
    expect(checkout?.repositoryFullName).toContain(STUB_REPOSITORIES.mobile.name);
    expect(checkout?.baseBranch).toBe(STUB_BRANCH);
    expect(checkout?.branch).toBe(`oppenheimer/${STUB_REPOSITORIES.mobile.name}/${session.slug}`);

    // ── The first task is in the log, and it named the session ───────────────
    const log = await owner.api.get(`/api/v1/sessions/${sessionId}/events`, {
      failOnStatusCode: false,
    });
    const kinds = ((await log.json()) as { data: { kind: string; payload: unknown }[] }).data;
    const prompt = kinds.find((entry) => entry.kind === 'prompt.first');
    if (!prompt) throw new Error('the composer’s task was not recorded as the first prompt');
    expect((prompt.payload as { text: string }).text).toBe(task);

    // Naming is not awaited by the create call, so it lands a moment later.
    await expect
      .poll(
        async () => {
          const again = await owner.api.get(`/api/v1/sessions/${sessionId}`);
          return ((await again.json()) as { name: string }).name;
        },
        { timeout: 15_000 },
      )
      .not.toBe(session.slug);

    await owner.api.dispose();
  });

  test('offers the way to pair a machine when there is no host', async ({ page }) => {
    const owner = await provisionedUser('nohost');
    await signInAs(page, owner.user);
    await page.goto('/sessions/new');

    // No host, no session: the screen says so and offers the step that fixes it
    // rather than an empty picker.
    await expect(page.getByText('No host yet')).toBeVisible();
    await page.getByRole('button', { name: 'Add a host' }).click();
    await expect(page).toHaveURL(/\/onboarding\/host/);

    await owner.api.dispose();
  });

  test('offers the way to connect GitHub when there is a host but no repository', async ({
    page,
  }) => {
    const owner = await provisionedUser('norepo');
    await pairHost(owner.api, 'Lonely box');

    await signInAs(page, owner.user);
    await page.goto('/sessions/new');

    await expect(page.getByText('No repository yet')).toBeVisible();
    await page.getByRole('button', { name: 'Connect GitHub' }).click();
    await expect(page).toHaveURL(/\/onboarding\/github/);

    await owner.api.dispose();
  });
});
