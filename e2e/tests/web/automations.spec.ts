import { expect, test } from '@playwright/test';
import { connectInstallation, createProject, pairHost } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Automations, in a browser, against the real control plane
 * (`product/versions/mvp/13-automations.md`, the 2026-09-27 export).
 *
 * The rail's second list and its pages, then an automation's whole life as a
 * person drives it: made in the three-step editor, listed in the table and
 * the sidebar, run now from its page, paused and resumed, edited into its
 * next revision, found on the Runs tab, and deleted with its runs kept. Only
 * GitHub is faked (`support/github-stub.ts`); the host is paired but has no
 * runner, so a run's session waits to start, which is what a run on an
 * offline host does.
 */
test('the rail switches to the automations list, and its pages link up', async ({ page }) => {
  const owner = await provisionedUser('automations');
  await signInAs(page, owner.user);
  await page.goto('/sessions');

  await page.getByRole('link', { name: 'Automations', exact: true }).click();
  await expect(page).toHaveURL(/\/automations$/);
  await expect(
    page.getByRole('button', { name: 'New automation', exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'New session', exact: true })).toHaveCount(0);
  // The run history is drawn before the first run: thirty empty days.
  await expect(page.getByText('Run history')).toBeVisible();
  await expect(page.getByRole('button', { name: /^0 runs/ })).toBeVisible();

  await page.getByRole('link', { name: 'Runs', exact: true }).click();
  await expect(page).toHaveURL(/\/automations\/runs$/);
  await expect(page.getByText('No runs yet. Each run appears here')).toBeVisible();
  await page.getByRole('link', { name: 'Automations', exact: true }).last().click();
  await expect(page).toHaveURL(/\/automations$/);

  await page.getByRole('link', { name: 'Sessions', exact: true }).click();
  await expect(page).toHaveURL(/\/sessions/);
  await owner.api.dispose();
});

test('an automation from the editor to deletion', async ({ page }) => {
  // Pairing redeems a token at an IP-throttled route; see `pairHost`.
  test.slow();
  const owner = await provisionedUser('automationui');
  await pairHost(owner.api, 'E2E box');
  const installationId = await connectInstallation(owner.api);
  await createProject(owner.api, installationId, 'XRP Mobile');

  await signInAs(page, owner.user);
  await page.goto('/automations');
  await expect(page.getByText('No automations yet. An automation starts a session')).toBeVisible();

  // Task: Next waits for both fields.
  await page.getByRole('button', { name: 'New automation', exact: true }).first().click();
  const editor = page.getByRole('dialog', { name: 'New automation' });
  await expect(editor).toBeVisible();
  const next = editor.getByRole('button', { name: 'Next' });
  await expect(next).toBeDisabled();
  await editor.getByLabel('Name').fill('Nightly audit');
  await editor.getByLabel('What should the agent do?').fill('Audit the manifests.');
  await expect(next).toBeEnabled();
  await next.click();

  // Trigger: a schedule, read back as a sentence with its next run.
  await expect(editor.getByText('Any trigger starts a run.')).toBeVisible();
  await expect(next).toBeDisabled();
  await editor.getByRole('button', { name: 'Add trigger' }).click();
  await page.getByRole('menuitem', { name: /^Weekdays/ }).click();
  await expect(editor.getByRole('button', { name: 'Weekdays' })).toBeVisible();
  await expect(editor.getByRole('button', { name: '09:00' })).toBeVisible();
  await expect(editor.getByText('Next run')).toBeVisible();
  // A GitHub card too: it listens on the project's repository.
  await editor.getByRole('button', { name: 'Add another trigger' }).click();
  await page.getByRole('menuitem', { name: /Pull request opened/ }).click();
  await expect(editor.getByText(/Listening on xrp-mobile/)).toBeVisible();
  await next.click();

  // Where it runs: prefilled from the project and the paired host.
  await expect(editor.getByText('Runs on')).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Project' })).toContainText('XRP Mobile');
  await expect(editor.getByRole('button', { name: 'Host' })).toContainText('E2E box');
  await editor.getByRole('button', { name: 'Create automation' }).click();
  await expect(editor).toHaveCount(0);

  // The table and the sidebar list it.
  const row = page.getByRole('row', { name: 'Nightly audit' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Weekdays at 09:00 +1');
  await expect(row).toContainText('Active');
  await expect(page.getByRole('listitem').filter({ hasText: 'Nightly audit' })).toBeVisible();

  // Its page: Run now starts a run, which the page's runs list shows.
  await row.click();
  await expect(page).toHaveURL(/\/automations\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Nightly audit' })).toBeVisible();
  await page.getByRole('button', { name: 'Run now' }).click();
  // Its title is the automation's and the cause until the agent names the
  // session; the row's automation column says whose it is either way.
  const run = page.getByRole('row').filter({ hasText: 'Nightly audit' }).last();
  await expect(run).toBeVisible({ timeout: 20_000 });

  // A run opens the session it started, with the automations list kept
  // beside it; Back returns to the automation's page.
  const automationUrl = page.url();
  await run.click();
  await expect(page).toHaveURL(/\/automations\/[0-9a-f-]{36}\/sessions\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole('button', { name: 'New automation', exact: true }).first(),
  ).toBeVisible();
  await page.goto(automationUrl);

  // Pause says why and offers Resume; Resume takes it back.
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Pause automation' }).click();
  await expect(page.getByText('Paused. Triggers are ignored until you resume it')).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByText('Paused. Triggers are ignored')).toHaveCount(0);

  // Edit opens the same dialog on what was saved.
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit automation' });
  await expect(edit.getByLabel('Name')).toHaveValue('Nightly audit');
  await edit.getByLabel('Name').fill('Nightly dependency audit');
  await edit.getByRole('tab', { name: /Where it runs/ }).click();
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(edit).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Nightly dependency audit' })).toBeVisible();

  // The Runs tab lists the run, with the status pills counting it.
  await page.goto('/automations/runs');
  const listed = page.getByRole('row').filter({ hasText: 'Nightly dependency audit' });
  await expect(listed).toBeVisible();
  await page.getByRole('button', { name: /^Failed/ }).click();
  await expect(page).toHaveURL(/status=failed/);
  await expect(page.getByText('No runs match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(listed).toBeVisible();

  // Delete, behind a confirm, from its page: the list is empty again and the
  // run is kept, under the deleted automation's name.
  await page.goto('/automations');
  await page.getByRole('row', { name: 'Nightly dependency audit' }).click();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete automation' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/automations$/);
  await expect(page.getByText('No automations yet. An automation starts a session')).toBeVisible();
  await page.goto('/automations/runs');
  await expect(page.getByRole('row').filter({ hasText: 'Deleted automation' })).toBeVisible();

  await owner.api.dispose();
});
