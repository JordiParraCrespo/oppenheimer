import { expect, type Page, test } from '@playwright/test';
import { pairHost } from '../../support/sessions';
import { provisionedUser, reloadFromServer, signInAs } from '../../support/web';

/**
 * Bots, slice 1, in a browser, against the real control plane
 * (`product/versions/mvp/25-bots.md`, `design/version1/Bots.dc.html` and
 * `BotSettings.dc.html`).
 *
 * One bot's whole life outside the chat: made blank from the Employees
 * sidebar, greeted in its chat (which says its provider needs a key first), renamed and
 * recoloured on Profile, moved into a new sidebar group, its INSTRUCTIONS.md
 * edited and reverted, a fact added, reworded and forgotten, a home host
 * picked, and deleted. The host is paired but no runner dials in: Runs on is
 * about what the control plane holds.
 */

const toast = (page: Page, text: string) =>
  page.locator('[data-sonner-toast]').filter({ hasText: text });

test('a bot from New bot to Delete bot', async ({ page }) => {
  test.slow();
  const owner = await provisionedUser('bots');
  await pairHost(owner.api, 'build-01');
  await signInAs(page, owner.user);

  // The rail's Employees opens the section, empty.
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  await expect(page).toHaveURL(/\/bots$/);
  await expect(page.getByRole('heading', { name: 'Make your first bot.' })).toBeVisible();
  await expect(page.getByText('No bots yet', { exact: true })).toBeVisible();

  // New bot: a blank bot, then its chat, which asks for the job.
  await page.getByRole('button', { name: 'New bot', exact: true }).first().click();
  await expect(page).toHaveURL(/\/bots\/[0-9a-f-]{36}$/);
  const chatUrl = page.url();
  const botId = chatUrl.split('/').pop() as string;
  await expect(
    page.getByRole('heading', { name: 'New Bot is ready. Tell it what job to do.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /New Bot/ })).toBeVisible();
  // Send stays off while the bot's provider has no key, and says where to add one.
  await expect(
    page.getByRole('status').filter({ hasText: 'Anthropic has no key in this workspace yet' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send' })).toHaveAttribute('aria-disabled', 'true');

  // Settings from the chat's menu opens on Profile.
  await page.getByRole('button', { name: 'Bot options' }).first().click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await expect(page).toHaveURL(new RegExp(`/bots/${botId}/settings/profile$`));
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();

  // Rename, describe, save; the bar over the page follows.
  await page.getByLabel('Name', { exact: true }).fill('Release Bot');
  await page.getByLabel('Description', { exact: true }).fill('Ships changes and watches runs');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await expect(page.getByRole('banner').getByText('Release Bot')).toBeVisible();

  // A colour applies as it is picked, and is the server's after a reload.
  await page.getByRole('button', { name: 'Coral' }).click();
  await expect(page.getByRole('button', { name: 'Coral' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await getBot(owner.api, botId)).avatarColor).toBe('coral');
  await reloadFromServer(page);
  await expect(page.getByRole('button', { name: 'Coral' })).toHaveAttribute('aria-pressed', 'true');

  // A new group in the sidebar, and the bot moved into it from its row's menu.
  await page.getByRole('link', { name: 'Open chat' }).click();
  await expect(page).toHaveURL(chatUrl);
  await page.getByRole('button', { name: 'New group', exact: true }).click();
  const groupName = page.getByRole('textbox', { name: 'Group name' });
  await groupName.fill('Engineering');
  await groupName.press('Enter');
  const engineering = page.locator('[data-slot="sidebar-project-header"]').filter({
    hasText: 'Engineering',
  });
  await expect(engineering).toContainText('0');
  const row = page.locator('[data-slot="bot-row"]').filter({ hasText: 'Release Bot' });
  await row.hover();
  await row.getByRole('button', { name: 'Bot options' }).click();
  await page.getByRole('menuitem', { name: 'Move to group' }).click();
  await page.getByRole('menuitem', { name: 'Engineering' }).click();
  await expect(engineering).toContainText('1');
  await expect(
    page.locator('[data-slot="sidebar-project-header"]').filter({ hasText: 'Ungrouped' }),
  ).toHaveCount(0);

  // INSTRUCTIONS.md: a revision saved, then reverted to the blank it was created with.
  await page.goto(`/bots/${botId}/settings/instructions`);
  const editor = page.getByRole('textbox', { name: 'INSTRUCTIONS.md' });
  await expect(editor).toHaveValue('');
  await editor.fill('# Job\n- Watch the nightly builds.');
  await page.getByRole('button', { name: 'Save revision' }).click();
  const history = page.locator('[data-slot="settings-list-row"]');
  await expect(history.filter({ hasText: 'Edited INSTRUCTIONS.md' })).toContainText('Current');
  await history.filter({ hasText: 'Created' }).getByRole('button', { name: 'Revert' }).click();
  await expect(history.filter({ hasText: 'Reverted to revision 1' })).toContainText('Current');
  await expect(editor).toHaveValue('');

  // Memory: a fact added, reworded and forgotten.
  await page.getByRole('link', { name: 'Memory' }).click();
  await expect(page.getByText('No facts yet. Add one below.')).toBeVisible();
  await page.getByRole('textbox', { name: 'New fact' }).fill('Prefers squash merges');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const fact = page.locator('[data-slot="settings-list-row"]').filter({
    hasText: 'squash merges',
  });
  await expect(fact).toContainText('Added by you');
  await fact.getByRole('button', { name: 'Edit' }).click();
  const rewording = page.getByRole('textbox', { name: 'Fact', exact: true });
  await rewording.fill('Prefers squash merges with the PR title');
  await rewording.press('Enter');
  await expect(fact).toContainText('Prefers squash merges with the PR title');
  await expect(fact).toContainText('Edited by you');
  await fact.getByRole('button', { name: /^Forget/ }).click();
  await expect(page.getByText('No facts yet. Add one below.')).toBeVisible();

  // Runs on: the paired host, offline, picked as the home host.
  await page.getByRole('link', { name: 'Runs on' }).click();
  const host = page.getByRole('radio', { name: /build-01/ });
  await expect(page.getByText(/Offline/)).toBeVisible();
  await host.click();
  await expect(host).toBeChecked();
  await expect.poll(async () => (await getBot(owner.api, botId)).homeHostId).not.toBeNull();
  await reloadFromServer(page);
  await expect(page.getByRole('radio', { name: /build-01/ })).toBeChecked();

  // Delete bot, behind its confirm, from the settings' menu: back to the list.
  await page.getByRole('button', { name: 'Bot options' }).click();
  await page.getByRole('menuitem', { name: 'Delete bot' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete Release Bot?' });
  await confirm.getByRole('button', { name: 'Delete bot' }).click();
  await expect(page).toHaveURL(/\/bots$/);
  await expect(toast(page, '“Release Bot” deleted.')).toBeVisible();
  expect((await owner.api.get(`/api/v1/bots/${botId}`)).status()).toBe(404);

  await owner.api.dispose();
});

async function getBot(
  api: Awaited<ReturnType<typeof provisionedUser>>['api'],
  id: string,
): Promise<{ avatarColor: string; homeHostId: string | null }> {
  const response = await api.get(`/api/v1/bots/${id}`);
  expect(response.status()).toBe(200);
  return (await response.json()) as { avatarColor: string; homeHostId: string | null };
}

test('a model provider key from Settings, and a bot moved onto it from the chat', async ({
  page,
}) => {
  const owner = await provisionedUser('botkeys');
  await signInAs(page, owner.user);

  await page.goto('/settings/model-providers');
  await expect(page.getByRole('heading', { name: 'Model providers', level: 1 })).toBeVisible();
  const glm = page.getByTestId('model-provider').filter({ hasText: 'GLM' });
  await expect(glm).toContainText('No key');

  // The key goes in a dialog and comes back only as its last four characters.
  await glm.getByRole('button', { name: 'Add key' }).click();
  const dialog = page.getByRole('dialog', { name: 'GLM key' });
  await dialog.getByLabel('API key').fill('zai-e2e-secret-4821');
  await dialog.getByRole('button', { name: 'Save key' }).click();
  await expect(dialog).toBeHidden();
  await expect(glm).toContainText('Key ending in 4821');
  await expect(page.getByText('zai-e2e-secret-4821')).toHaveCount(0);

  // A bot's model button lists every provider's models; GLM-5.3 moves it there.
  const created = await owner.api.post('/api/v1/bots', { data: { name: 'Glm Bot' } });
  const botId = ((await created.json()) as { id: string }).id;
  await page.goto(`/bots/${botId}`);
  await page.getByRole('button', { name: 'Model' }).click();
  await page.getByRole('menuitem', { name: 'GLM' }).click();
  await page.getByRole('option', { name: 'GLM-5.3' }).click();
  await expect(page.getByRole('button', { name: 'Model' })).toContainText('GLM-5.3');
  await expect
    .poll(
      async () =>
        (
          (await (await owner.api.get(`/api/v1/bots/${botId}`)).json()) as {
            provider: string;
          }
        ).provider,
    )
    .toBe('glm');

  // Remove forgets it.
  await page.goto('/settings/model-providers');
  await glm.getByRole('button', { name: 'Remove the GLM key' }).click();
  await expect(glm).toContainText('No key');
  await owner.api.dispose();
});

test('ChatGPT signs in from Settings with a device code, not a key', async ({ page }) => {
  const owner = await provisionedUser('botchatgpt');
  await signInAs(page, owner.user);
  // The two routes that reach OpenAI answer here: the console's half of the
  // flow is what this covers; the API's is its own specs'.
  await page.route('**/api/v1/model-providers/chatgpt/login', (route) =>
    route.fulfill({
      json: {
        flowId: 'flow-e2e',
        userCode: 'E2E1-CODE',
        verificationUrl: 'https://auth.openai.com/codex/device',
        intervalSeconds: 1,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      },
    }),
  );
  let polls = 0;
  await page.route('**/api/v1/model-providers/chatgpt/login/poll', (route) =>
    route.fulfill({ json: { status: ++polls < 2 ? 'pending' : 'connected' } }),
  );

  await page.goto('/settings/model-providers');
  const chatgpt = page.getByTestId('model-provider').filter({ hasText: 'ChatGPT' });
  await expect(chatgpt).toContainText('Not connected');
  await chatgpt.getByRole('button', { name: 'Connect ChatGPT' }).click();

  const dialog = page.getByRole('dialog', { name: 'Connect ChatGPT' });
  await expect(dialog.getByTestId('chatgpt-user-code')).toContainText('E2E1-CODE');
  await expect(dialog.getByRole('link', { name: 'Open sign-in page' })).toHaveAttribute(
    'href',
    'https://auth.openai.com/codex/device',
  );
  await expect(dialog).toContainText('Signed in. Bots on ChatGPT now run on this subscription.');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();
  await owner.api.dispose();
});
