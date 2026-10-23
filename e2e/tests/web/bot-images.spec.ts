import { expect, type Page, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Images in a bot's chat, in a browser (`product/versions/mvp/25-bots.md`
 * §3.1): an image picked in the composer is a tile over the text, sent with
 * the message and drawn above its bubble, read back through the API; on a
 * GLM bot, whose model reads no images, the pick is refused under the box
 * and what was written stays. No model is called: the turn runs on a
 * placeholder key, and how it ends is not what this proves.
 */

/** A 1×1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const dot = { name: 'dot.png', mimeType: 'image/png', buffer: PNG };

/** Picks `dot.png` the way a person does: the paperclip, then the file chooser. */
async function pickImage(page: Page) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add images' }).click();
  await (await chooser).setFiles(dot);
}

test('an image picked in the composer is sent with the message and stays in the chat', async ({
  page,
}) => {
  const owner = await provisionedUser('botimagesweb');
  expect(
    (
      await owner.api.put('/api/v1/model-providers/anthropic', {
        data: { apiKey: 'sk-ant-e2e-placeholder-key' },
      })
    ).status(),
  ).toBe(204);
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Vision Bot', provider: 'anthropic' } })
  ).json()) as { id: string };
  await signInAs(page, owner.user);
  await page.goto(`/bots/${bot.id}`);

  await pickImage(page);
  const composer = page.locator('[data-slot="chat-composer"]');
  await expect(composer.getByRole('img', { name: 'dot.png' })).toBeVisible();
  await expect(composer.getByRole('button', { name: 'Remove dot.png' })).toBeVisible();
  await page.getByPlaceholder('Message Vision Bot').fill('What is in this picture?');
  const send = page.getByRole('button', { name: 'Send' });
  await expect(send).not.toHaveAttribute('aria-disabled', 'true');
  await send.click();

  const sent = page.locator('[data-slot="chat-user-message"]');
  await expect(sent).toContainText('What is in this picture?');
  await expect(sent.getByRole('link', { name: 'Open dot.png' })).toBeVisible();
  await expect(composer.getByRole('img', { name: 'dot.png' })).toHaveCount(0);

  // Read back from the API after a reload, not from what the composer held.
  await page.reload();
  await expect(
    page.locator('[data-slot="chat-user-message"]').getByRole('img', { name: 'dot.png' }),
  ).toBeVisible();
});

test('a GLM bot refuses an image and keeps what was written', async ({ page }) => {
  const owner = await provisionedUser('botimagesglmweb');
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Text Bot', provider: 'glm' } })
  ).json()) as { id: string };
  await signInAs(page, owner.user);
  await page.goto(`/bots/${bot.id}`);

  const box = page.getByPlaceholder('Message Text Bot');
  await box.fill('Describe this');
  await pickImage(page);

  await expect(
    page.getByText("GLM-5.3 can't read images. Switch the bot's model to send them."),
  ).toBeVisible();
  await expect(page.locator('[data-slot="chat-image"]')).toHaveCount(0);
  await expect(box).toHaveValue('Describe this');
});
