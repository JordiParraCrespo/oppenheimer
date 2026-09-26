import { expect, test } from '@playwright/test';
import {
  connectInstallation,
  pairHost,
  STUB_BRANCH,
  STUB_INSTALL_URL,
  STUB_REPOSITORIES,
} from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * New session, in a browser, against the real control plane.
 *
 * What this covers that nothing else can: the screen's five pickers are bound
 * to four live reads and two writes, and a session created here is a row the
 * API actually holds — in the project the dialog made, with the launch
 * options the foot row was set to, the first task in its log, and a name
 * derived from that task.
 *
 * The only thing faked in the run is **GitHub**, which answers repositories and
 * branches live through an App this deployment does not have
 * (`support/github-stub.ts`). The browser, the console, the API's guards, its
 * Zod pipe and its Postgres are all the real ones.
 *
 * The run needs the stack up and the API pointed at the stub — see
 * `e2e/README.md`.
 *
 * An account with no machine is no longer a separate screen: the composer
 * renders either way and the host chip's foot action opens Add host, which is
 * `add-host.spec.ts`'s subject.
 */
test.describe('New session', () => {
  test('starts a session with the scope, the foot row and the first task', async ({ page }) => {
    // Pairing redeems a token at an IP-throttled route; see `pairHost`.
    test.slow();
    const owner = await provisionedUser('newsession');
    const hostId = await pairHost(owner.api, 'E2E box');
    await connectInstallation(owner.api);

    await signInAs(page, owner.user);
    await page.goto('/sessions/new');

    await expect(page.getByRole('heading', { name: 'New session' })).toBeVisible();

    // ── The prompt box has the size the export gives it ──────────────────────
    // It lost that size once: `field-sizing-content` overrides the `rows`
    // attribute, so an empty textarea collapsed to a single line while every
    // class still looked right. Nothing in jsdom can catch it — it needs a
    // browser that has applied the stylesheet — and the number is what
    // `product/versions/mvp/design/_ds/…/terminal.css` states for
    // `.op-composer__input`. Asserted here rather than in a spec of its own
    // because the composer only renders once a host exists, and pairing a
    // second one would trip the per-IP throttle this file already works around.
    // 128px since the composer became tabbed (the scope band over the field
    // grows the field to `min-h-32`, `[data-composer="tabbed"]` in console.css).
    const composer = page.getByRole('textbox', { name: /Describe a task/ });
    expect((await composer.boundingBox())?.height, 'the empty composer is 128px tall').toBe(128);

    // ── The project chip, and the dialog behind its foot row ─────────────────
    // A fresh workspace holds no project; the way to one is inside the chip.
    await page.getByRole('button', { name: 'Project' }).click();
    await page.getByRole('option', { name: 'New project…' }).click();
    const dialog = page.getByRole('dialog', { name: 'New project' });
    await dialog.getByLabel('Name').fill('XRP');
    // Ticking a repository makes it a default and names the project's directory.
    await dialog.getByRole('checkbox', { name: new RegExp(STUB_REPOSITORIES.web.name) }).check();
    await dialog.getByRole('button', { name: 'E2E box' }).click();
    await dialog.getByRole('button', { name: 'Create project' }).click();
    await expect(dialog).toBeHidden();
    // Picking the project prefilled the host and the repository from its defaults.
    await expect(page.getByRole('button', { name: 'Project' })).toContainText('XRP');
    await expect(page.getByRole('button', { name: 'Host' })).toContainText('E2E box');
    await expect(page.getByRole('button', { name: 'Repositories' })).toContainText(
      STUB_REPOSITORIES.web.name,
    );

    // ── The host chip ────────────────────────────────────────────────────────
    // Prefilled above; picking it again by hand is what a reader with two
    // machines does, and the chip must still take the choice.
    await page.getByRole('button', { name: 'Host' }).click();
    await page.getByRole('option', { name: /E2E box/ }).click();
    await expect(page.getByRole('button', { name: 'Host' })).toContainText('E2E box');

    // ── The repository chip, and the branch pane inside it ───────────────────
    // One repository per session in the MVP: picking another replaces the
    // project's default, which is the per-session override 12 describes.
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
      projectId: string;
      agent: string;
      lifecycle: string;
      launch: { model: string | null; permission: string; effort: string | null };
      checkouts: { repositoryFullName: string; baseBranch: string; branch: string }[];
      hostId: string;
    };

    expect(session.hostId).toBe(hostId);
    expect(session.agent).toBe('claude-code');

    // The session is in the project the dialog made, whose directory is named
    // after the repository ticked there — not after the one the session checked out.
    const projects = await owner.api.get('/api/v1/projects');
    const [project] = (await projects.json()) as { id: string; name: string; slug: string }[];
    expect(project?.name).toBe('XRP');
    expect(project?.slug).toBe(STUB_REPOSITORIES.web.name);
    expect(session.projectId).toBe(project?.id);
    expect(session.launch.permission, 'the foot row is what was sent').toBe('auto');
    expect(session.launch.model, 'the engine button carries a model').toBeTruthy();
    expect(session.lifecycle, 'nothing has built a worktree yet').toBe('starting');

    // The branch chosen in the pane is the **base**; the session works on its own.
    const [checkout] = session.checkouts;
    expect(checkout?.repositoryFullName).toContain(STUB_REPOSITORIES.mobile.name);
    expect(checkout?.baseBranch).toBe(STUB_BRANCH);
    expect(checkout?.branch).toBe(`oppenheimer/${STUB_REPOSITORIES.web.name}/${session.slug}`);

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

  test('offers the way to GitHub when there is a host but no repository', async ({ page }) => {
    // Pairing redeems a token at an IP-throttled route; see `pairHost`.
    test.slow();
    const owner = await provisionedUser('norepo');
    await pairHost(owner.api, 'Lonely box');

    await signInAs(page, owner.user);
    await page.goto('/sessions/new');

    // The empty screens are gone: an account with nothing connected still gets
    // the composer, and the way out is inside the chip that is empty.
    await page.getByRole('button', { name: 'Repositories' }).click();
    const manage = page.getByRole('link', { name: 'Manage repository access' });
    await expect(manage).toHaveAttribute('href', STUB_INSTALL_URL);
    await expect(manage).toHaveAttribute('target', '_blank');

    await owner.api.dispose();
  });
});
