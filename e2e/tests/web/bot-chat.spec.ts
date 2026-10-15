import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * A bot's chat in a browser, against the real control plane and a real model
 * (`product/versions/mvp/25-bots.md` §3): a message sent from the composer
 * becomes a turn that works and then shows how it went, the bot's answer
 * beneath it, and the box is Send again. The model is GLM, through
 * `GLM_API_KEY`; without it the spec is skipped.
 */

test.describe.configure({ timeout: 180_000 });

test('a GLM bot answers in its chat', async ({ page }) => {
  const key = process.env.GLM_API_KEY;
  test.skip(!key, 'GLM_API_KEY is not set: the live turn needs a real key');
  const owner = await provisionedUser('botchatweb');
  expect(
    (await owner.api.put('/api/v1/model-providers/glm', { data: { apiKey: key } })).status(),
  ).toBe(204);
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Fruit Bot', provider: 'glm' } })
  ).json()) as { id: string };
  await signInAs(page, owner.user);

  await page.goto(`/bots/${bot.id}`);
  await expect(
    page.getByRole('heading', { name: 'Fruit Bot is ready. Tell it what job to do.' }),
  ).toBeVisible();
  const box = page.getByPlaceholder('Message Fruit Bot');
  await box.fill('Reply with exactly the word: pineapple');
  await page.getByRole('button', { name: 'Send' }).click();

  // Your message as a bubble, the turn at work, then its answer and how it went.
  await expect(page.locator('[data-slot="chat-user-message"]')).toContainText(
    'Reply with exactly the word: pineapple',
  );
  await expect(box).toHaveValue('');
  await expect(page.locator('[data-slot="bot-turn"][data-phase="completed"]')).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.locator('[data-slot="chat-reply"]').last()).toContainText(/pineapple/i);
  // Under it, how it went: its model, and a copy button for the answer.
  await expect(page.locator('[data-slot="message-trail"]')).toContainText('GLM-5.3');
  await expect(page.getByRole('button', { name: 'Copy reply' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  // The sidebar's row previews the last thing said.
  await expect(
    page.locator('[data-slot="bot-row"]').filter({ hasText: 'Fruit Bot' }),
  ).toContainText(/pineapple/i);
});
