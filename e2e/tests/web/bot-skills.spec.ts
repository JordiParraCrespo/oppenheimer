import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * A bot's skills in a browser, against the real control plane
 * (`product/versions/mvp/25-bots.md` §4.1): a skill added on its Settings tab
 * is on the server, edits and deletes there, and its command is offered by
 * the chat's `/` menu, which writes it into the composer for its input. What
 * a turn does with a command is the API's integration spec, since a real
 * model is not run here.
 */
test("a bot's skill from its Skills tab to the chat's / menu", async ({ page }) => {
  const owner = await provisionedUser('botskills');
  await owner.api.put('/api/v1/model-providers/glm', { data: { apiKey: 'e2e-placeholder' } });
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Juno', provider: 'glm' } })
  ).json()) as { id: string };
  await signInAs(page, owner.user);

  await page.goto(`/bots/${bot.id}/settings/skills`);
  await expect(page.getByText(/No skills yet/)).toBeVisible();

  // Added through the dialog, the name typed into the shape of a command.
  await page.getByRole('button', { name: 'Add skill' }).click();
  const dialog = page.getByRole('dialog', { name: 'New skill' });
  await dialog.getByLabel('Name').fill('Release Notes');
  await expect(dialog.getByLabel('Name')).toHaveValue('release-notes');
  await expect(dialog.getByText('You run it as /release-notes.')).toBeVisible();
  await dialog.getByLabel('Description').fill('Writes release notes from the merged pull requests');
  await dialog.getByLabel('Instructions').fill('1. List the merged pull requests.\n2. Group them.');
  await dialog.getByRole('button', { name: 'Save skill' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('/release-notes')).toBeVisible();

  const saved = (await (await owner.api.get(`/api/v1/bots/${bot.id}/skills`)).json()) as {
    name: string;
    body: string;
    userInvocable: boolean;
    modelInvocable: boolean;
  }[];
  expect(saved).toEqual([
    expect.objectContaining({
      name: 'release-notes',
      body: '1. List the merged pull requests.\n2. Group them.',
      userInvocable: true,
      modelInvocable: true,
    }),
  ]);

  // A second skill of that name is refused, in words.
  await page.getByRole('button', { name: 'Add skill' }).click();
  const again = page.getByRole('dialog', { name: 'New skill' });
  await again.getByLabel('Name').fill('release-notes');
  await again.getByLabel('Description').fill('Twice');
  await again.getByLabel('Instructions').fill('Twice.');
  await again.getByRole('button', { name: 'Save skill' }).click();
  await expect(again.getByText('This bot already has a skill with that name')).toBeVisible();
  await again.getByRole('button', { name: 'Cancel' }).click();

  // Edited: only the bot uses it now, and the row says so.
  await page.getByRole('button', { name: 'Edit /release-notes' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit /release-notes' });
  await edit.getByRole('checkbox', { name: 'I can run it from the chat with its command' }).click();
  await edit.getByRole('button', { name: 'Save skill' }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByText('Only the bot uses it')).toBeVisible();

  // ...so the chat's menu does not offer it; turned back on, it does.
  await page.goto(`/bots/${bot.id}`);
  const composer = page.getByPlaceholder('Message Juno');
  await composer.fill('/');
  await expect(page.getByRole('listbox', { name: 'Skills you can run' })).toBeHidden();
  await owner.api.patch(`/api/v1/bots/${bot.id}/skills/${await skillId(owner, bot.id)}`, {
    data: { userInvocable: true },
  });
  await page.reload();
  await composer.fill('/rel');
  const menu = page.getByRole('listbox', { name: 'Skills you can run' });
  await expect(menu.getByRole('option', { name: 'Use /release-notes' })).toBeVisible();
  await composer.press('Enter');
  await expect(composer).toHaveValue('/release-notes ');
  await expect(menu).toBeHidden();

  // Deleted, it leaves the tab and the menu.
  await page.goto(`/bots/${bot.id}/settings/skills`);
  await page.getByRole('button', { name: 'Delete /release-notes' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete /release-notes?' });
  await confirm.getByRole('button', { name: 'Delete /release-notes' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByText(/No skills yet/)).toBeVisible();
});

async function skillId(
  owner: Awaited<ReturnType<typeof provisionedUser>>,
  botId: string,
): Promise<string> {
  const [skill] = (await (await owner.api.get(`/api/v1/bots/${botId}/skills`)).json()) as {
    id: string;
  }[];
  if (!skill) throw new Error('no skill');
  return skill.id;
}
