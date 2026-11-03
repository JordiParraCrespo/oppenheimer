import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The built-in `/loop` in a browser, against the real control plane
 * (`product/versions/mvp/25-bots.md` §4.1, "Built-in commands"): the chat's
 * `/` menu offers it, an interval out of range keeps send off and says the
 * range, `/loop stop` stops the loop without sending the bot a message, and
 * the API refuses both as messages and answers no loop. Setting a loop, its
 * runs and how it ends are the API's integration and unit specs, since a
 * real model is not run here (a run on the placeholder key would fail, and
 * end the loop, before the page could show it).
 */
test('the /loop command from the chat’s menu to the composer', async ({ page }) => {
  const owner = await provisionedUser('botloop');
  await owner.api.put('/api/v1/model-providers/glm', { data: { apiKey: 'e2e-placeholder' } });
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Juno', provider: 'glm' } })
  ).json()) as { id: string };
  await signInAs(page, owner.user);
  await page.goto(`/bots/${bot.id}`);

  const composer = page.getByPlaceholder('Message Juno');
  await composer.fill('/lo');
  const menu = page.getByRole('listbox', { name: 'Commands and skills you can run' });
  await expect(menu.getByRole('option', { name: 'Use /loop' })).toBeVisible();
  await composer.press('Enter');
  await expect(composer).toHaveValue('/loop ');

  // An interval out of range: send stays off and the notice says the range.
  await composer.fill('/loop 0m check the deploy');
  await expect(page.getByText(/A loop runs every 1 minute to 1 day/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();

  // /loop stop stops the loop and sends nothing: the field empties, no turn.
  await composer.fill('/loop stop');
  await composer.press('Enter');
  await expect(composer).toHaveValue('');
  const conversation = (await (
    await owner.api.get(`/api/v1/bots/${bot.id}/conversation`)
  ).json()) as { messages?: unknown[] };
  expect(conversation.messages ?? []).toHaveLength(0);

  // Sent through the API instead, both are refused, and there is no loop.
  for (const content of ['/loop stop', '/loop 2d check']) {
    const refused = await owner.api.post(`/api/v1/bots/${bot.id}/messages`, { data: { content } });
    expect(refused.status()).toBe(400);
  }
  const read = await owner.api.get(`/api/v1/bots/${bot.id}/loop`);
  expect(read.status()).toBe(200);
  expect(await read.json()).toEqual({ loop: null });
});
