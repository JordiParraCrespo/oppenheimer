import { expect, test } from '@playwright/test';
import { turnOnForEveryone } from '../../support/flags';
import { STUB_TRANSCRIPT, tidied } from '../../support/namer-stub';
import { connectInstallation, pairHost, STUB_REPOSITORIES } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Dictating a first task on New session, in a browser with a microphone:
 * Chromium's fake device (a steady tone) records, the console encodes it as
 * the WAV the API takes, the deployment's speech server (the stub) hears its
 * one sentence, and the tidied text lands in the composer for the person to
 * read before sending.
 */
test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
  permissions: ['microphone'],
});

test.describe('Dictation', () => {
  test('puts what was said into the composer, tidied, without sending it', async ({ page }) => {
    test.slow();
    const owner = await provisionedUser('dictation');
    await turnOnForEveryone(owner.api, 'voice_dictation');
    await pairHost(owner.api, 'Dictation box');
    await connectInstallation(owner.api);

    await signInAs(page, owner.user);
    await page.goto('/sessions/new');
    await page.getByRole('button', { name: 'Host' }).click();
    await page.getByRole('option', { name: /Dictation box/ }).click();
    await page.getByRole('button', { name: 'Repositories' }).click();
    await page.getByRole('option', { name: new RegExp(STUB_REPOSITORIES.web.name) }).click();
    await page.keyboard.press('Escape');

    const composer = page.getByRole('textbox', { name: /Describe a task/ });
    await composer.fill('First,');
    await page.getByRole('button', { name: 'Dictate' }).click();

    // Recording: the foot row gives way to the recorder, its clock moving.
    const recorder = page.locator('[data-slot="voice-recorder-bar"][data-state="recording"]');
    await expect(recorder).toBeVisible();
    await expect(recorder.getByText('0:01')).toBeVisible({ timeout: 10_000 });
    await recorder.getByRole('button', { name: 'Stop recording' }).click();

    await expect(composer).toHaveValue(`First, ${tidied(STUB_TRANSCRIPT)}`, { timeout: 15_000 });
    await expect(page.locator('[data-slot="voice-recorder-bar"]')).toHaveCount(0);
    // Nothing was sent: the person reads it first.
    await expect(page).toHaveURL(/\/sessions\/new/);
  });
});
