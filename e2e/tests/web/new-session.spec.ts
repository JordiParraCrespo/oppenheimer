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
 * New session, in a browser, against the real control plane: a session created
 * here is a row the API actually holds — in the project the page made, with the
 * launch options the foot row was set to, the first task in its log, and a
 * name derived from that task.
 *
 * Only GitHub is faked (`support/github-stub.ts`); the run needs the stack up
 * and the API pointed at the stub (`e2e/README.md`).
 */
test.describe('New session', () => {
  test('starts a session with the scope, the foot row and the first task', async ({ page }) => {
    test.slow();
    const owner = await provisionedUser('newsession');
    const hostId = await pairHost(owner.api, 'E2E box');
    await connectInstallation(owner.api);

    await signInAs(page, owner.user);
    await page.goto('/sessions/new');

    await expect(page.getByRole('heading', { name: 'New session' })).toBeVisible();

    // ── The prompt box has the size the export gives it ──────────────────────
    // `field-sizing-content` overrides `rows`, so an empty textarea once
    // collapsed to one line with every class still right; only a browser that
    // applied the stylesheet sees it. 128px is `min-h-32`, the tabbed composer
    // (`[data-composer="tabbed"]` in console.css). Asserted here because the
    // composer needs a host, and pairing another would trip the per-IP throttle.
    const composer = page.getByRole('textbox', { name: /Describe a task/ });
    expect((await composer.boundingBox())?.height, 'the empty composer is 128px tall').toBe(128);

    // ── The project chip, and the dialog behind its foot row ─────────────────
    // A fresh workspace has only its Unassigned project, and the chip starts
    // there: it is where a session that names none is listed. The way to a
    // named one is inside the chip, a dialog over the console (the
    // 2026-09-27 export).
    await expect(page.getByRole('button', { name: 'Project', exact: true })).toContainText(
      'Unassigned',
    );
    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByRole('button', { name: 'New project…' }).click();
    const projectDialog = page.getByRole('dialog', { name: 'New project' });
    await expect(projectDialog).toBeVisible();
    await expect(projectDialog.getByRole('button', { name: 'Create project' })).toBeDisabled();
    await projectDialog.getByLabel('Name').fill('XRP');
    // Adding a repository makes it cloned by default.
    await projectDialog.getByRole('button', { name: 'Add a repository…' }).click();
    // The picker's listbox is a popover, portaled outside the dialog.
    await page
      .getByRole('listbox')
      .getByRole('option', { name: new RegExp(STUB_REPOSITORIES.web.name) })
      .click();
    // The default host is in the Defaults fold.
    await projectDialog.getByRole('button', { name: /^Defaults/ }).click();
    await projectDialog.getByRole('button', { name: 'E2E box' }).click();
    await projectDialog.getByRole('button', { name: 'Create project' }).click();
    await expect(projectDialog).toHaveCount(0);
    // Picking it prefilled the host and the repository from its defaults.
    await expect(page.getByRole('button', { name: 'Project', exact: true })).toContainText('XRP');
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

    // The session is in the project the page made, which took its slug from
    // its name; a project names nothing on disk.
    const projects = await owner.api.get('/api/v1/projects');
    const project = ((await projects.json()) as { id: string; name: string; slug: string }[]).find(
      (candidate) => candidate.name === 'XRP',
    );
    expect(project?.slug).toBe('xrp');
    expect(session.projectId).toBe(project?.id);
    expect(session.launch.permission, 'the foot row is what was sent').toBe('auto');
    expect(session.launch.model, 'the engine button carries a model').toBeTruthy();
    expect(session.lifecycle, 'nothing has built a worktree yet').toBe('starting');

    // The branch chosen in the pane is the **base**; the session works on its own.
    const [checkout] = session.checkouts;
    expect(checkout?.repositoryFullName).toContain(STUB_REPOSITORIES.mobile.name);
    expect(checkout?.baseBranch).toBe(STUB_BRANCH);
    expect(checkout?.branch).toBe(`oppenheimer/${session.slug}`);

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
    test.slow();
    const owner = await provisionedUser('norepo');
    await pairHost(owner.api, 'Lonely box');

    await signInAs(page, owner.user);
    await page.goto('/sessions/new');

    // The empty screens are gone: an account with nothing connected still gets
    // the composer, and the way out is inside the chip that is empty.
    await page.getByRole('button', { name: 'Repositories' }).click();
    // A button that mints the install state on click, then points a new tab
    // at GitHub with it: there is no address to hold in an `href` at render.
    // GitHub itself is answered here, so the run never leaves the machine.
    await page
      .context()
      .route('https://github.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'text/html', body: '<p>GitHub</p>' }),
      );
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Manage repository access' }).click();
    const tab = await popup;
    await tab.waitForURL((url) => url.href.startsWith(`${STUB_INSTALL_URL}?state=`));
    expect(new URL(tab.url()).searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Cut from the console, as the `rel="noopener"` link it replaced was.
    expect(await tab.evaluate(() => window.opener)).toBeNull();

    await owner.api.dispose();
  });
});
