import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The built-in `/schedule` in a browser, against the real control plane
 * (`product/versions/mvp/25-bots.md` §4.1, "Built-in commands"): the chat's
 * `/` menu offers it, `/schedule` alone opens the bot's Routines tab without
 * sending the bot a message, and the API refuses it as a message. The bot
 * saving the routine a `/schedule <request>` asks for, with no card, is the
 * API's unit specs (`update_routine`, `composeTurnMessage`), since a real
 * model is not run here.
 */
test('the /schedule command from the chat’s menu to the routines', async ({ page }) => {
  const owner = await provisionedUser('botschedule');
  await owner.api.put('/api/v1/model-providers/glm', { data: { apiKey: 'e2e-placeholder' } });
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Juno', provider: 'glm' } })
  ).json()) as { id: string };
  await signInAs(page, owner.user);
  await page.goto(`/bots/${bot.id}`);

  const composer = page.getByPlaceholder('Message Juno');
  await composer.fill('/sch');
  const menu = page.getByRole('listbox', { name: 'Commands and skills you can run' });
  await expect(menu.getByRole('option', { name: 'Use /schedule' })).toBeVisible();

  // Picked from the menu, then sent alone, it opens the routines and sends nothing.
  await composer.press('Enter');
  await expect(composer).toHaveValue('/schedule ');
  await composer.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/bots/${bot.id}/settings/routines`));
  const conversation = (await (
    await owner.api.get(`/api/v1/bots/${bot.id}/conversation`)
  ).json()) as { messages?: unknown[] };
  expect(conversation.messages ?? []).toHaveLength(0);

  // Sent through the API instead, it is refused.
  const refused = await owner.api.post(`/api/v1/bots/${bot.id}/messages`, {
    data: { content: '/schedule' },
  });
  expect(refused.status()).toBe(400);
});
