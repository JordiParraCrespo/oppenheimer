import { expect, test } from '@playwright/test';
import { turnOnForEveryone } from '../../support/flags';
import { STUB_TRANSCRIPT, tidied } from '../../support/namer-stub';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Dictation outside New session, through the kit's `DictationField`: a new
 * task's notes, in a browser with Chromium's fake microphone. The mic sits in
 * the field's corner, the recorder shows under it while recording, and the
 * deployment's speech server (the stub) is heard and tidied onto the end of
 * what was typed, in the form, before anything is saved.
 */
test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
  permissions: ['microphone'],
});

test('dictates a new task’s notes onto what was typed, without saving', async ({ page }) => {
  test.slow();
  const owner = await provisionedUser('dictation-notes');
  await turnOnForEveryone(owner.api, 'voice_dictation');
  await signInAs(page, owner.user);
  await page.goto('/plan');

  await page.getByRole('button', { name: 'New task', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New task' });
  const notes = dialog.getByLabel('Notes');
  await notes.fill('First,');
  await dialog.getByRole('button', { name: 'Dictate' }).click();

  const recorder = dialog.locator('[data-slot="voice-recorder-bar"][data-state="recording"]');
  await expect(recorder).toBeVisible();
  await expect(recorder.getByText('0:01')).toBeVisible({ timeout: 10_000 });
  await recorder.getByRole('button', { name: 'Stop recording' }).click();

  await expect(notes).toHaveValue(`First, ${tidied(STUB_TRANSCRIPT)}`, { timeout: 15_000 });
  await expect(dialog.locator('[data-slot="voice-recorder-bar"]')).toHaveCount(0);
  // Nothing was saved: the dialog is still open on the draft.
  await expect(dialog).toBeVisible();
});
