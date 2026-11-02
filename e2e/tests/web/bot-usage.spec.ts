import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The built-in `/usage` in a browser, against the real control plane
 * (`product/versions/mvp/25-bots.md` §4.1, "Built-in commands"): the chat's
 * `/` menu offers it, running it opens the usage card without sending the
 * bot a message, and the API answers the chat's usage and refuses `/usage`
 * as a message. What a turn and a goal review add to the figures is the
 * API's integration spec, since a real model is not run here.
 */
test('the /usage command opens the usage card and sends nothing', async ({ page }) => {
  const owner = await provisionedUser('botusage');
  await owner.api.put('/api/v1/model-providers/glm', { data: { apiKey: 'e2e-placeholder' } });
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Juno', provider: 'glm' } })
  ).json()) as { id: string };

  const usage = await owner.api.get(`/api/v1/bots/${bot.id}/usage`);
  expect(usage.status()).toBe(200);
  expect(await usage.json()).toEqual({
    since: null,
    turns: 0,
    activeMs: 0,
    models: [],
    background: [],
  });
  const refused = await owner.api.post(`/api/v1/bots/${bot.id}/messages`, {
    data: { content: '/usage' },
  });
  expect(refused.status()).toBe(400);

  await signInAs(page, owner.user);
  await page.goto(`/bots/${bot.id}`);
  const composer = page.getByPlaceholder('Message Juno');
  await composer.fill('/us');
  const menu = page.getByRole('listbox', { name: 'Commands and skills you can run' });
  await expect(menu.getByRole('option', { name: 'Use /usage' })).toBeVisible();
  await composer.press('Enter');
  await expect(composer).toHaveValue('/usage ');
  await composer.press('Enter');

  const card = page.getByRole('dialog', { name: 'Usage' });
  await expect(card.getByText('This chat')).toBeVisible();
  await expect(card.getByText('Nothing spent in this chat yet.')).toBeVisible();
  await expect(composer).toHaveValue('');
  const conversation = (await (
    await owner.api.get(`/api/v1/bots/${bot.id}/conversation`)
  ).json()) as { messages?: unknown[] };
  expect(conversation.messages ?? []).toHaveLength(0);
});
