import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The built-in `/goal` in a browser, against the real control plane
 * (`product/versions/mvp/25-bots.md` §4.1, "Built-in commands"): the chat's
 * `/` menu offers it under Commands before any skill, `/goal` with no
 * condition keeps send off and says what it lacks, `/goal clear` stops the
 * goal without sending the bot a message, and the API refuses both as
 * messages. Setting a goal and the reviewer's verdicts are the API's
 * integration and unit specs, since a real model is not run here.
 */
test('the /goal command from the chat’s menu to the composer', async ({ page }) => {
  const owner = await provisionedUser('botgoal');
  await owner.api.put('/api/v1/model-providers/glm', { data: { apiKey: 'e2e-placeholder' } });
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Juno', provider: 'glm' } })
  ).json()) as { id: string };
  await signInAs(page, owner.user);
  await page.goto(`/bots/${bot.id}`);

  const composer = page.getByPlaceholder('Message Juno');
  await composer.fill('/go');
  const menu = page.getByRole('listbox', { name: 'Commands and skills you can run' });
  await expect(menu.getByText('Commands')).toBeVisible();
  await expect(menu.getByRole('option', { name: 'Use /goal' })).toBeVisible();
  await composer.press('Enter');
  await expect(composer).toHaveValue('/goal ');

  // With no condition, send stays off and says what is missing.
  // The notice on the box's top edge; the disabled send carries the same words for a reader.
  await expect(
    page
      .getByText('Write what done looks like after /goal, or /goal clear to stop the goal.')
      .first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();

  // /goal clear stops the goal and sends nothing: the field empties, no turn.
  await composer.fill('/goal clear');
  await composer.press('Enter');
  await expect(composer).toHaveValue('');
  const conversation = (await (
    await owner.api.get(`/api/v1/bots/${bot.id}/conversation`)
  ).json()) as { messages?: unknown[] };
  expect(conversation.messages ?? []).toHaveLength(0);

  // Sent through the API instead, both are refused and nothing is queued.
  for (const content of ['/goal', '/goal stop']) {
    const refused = await owner.api.post(`/api/v1/bots/${bot.id}/messages`, { data: { content } });
    expect(refused.status()).toBe(400);
  }
});
