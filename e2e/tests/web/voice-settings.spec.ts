import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Settings → Model providers, Voice, against the real control plane: a Groq
 * key stored from its row (voice only, so it never offers Make default), then,
 * on the Voice tab, picked to hear dictation with a model of its own, and the choice is what
 * the API holds. Breaks if the voice-only providers cannot take a key, if a
 * new key does not reach the Voice rows without a reload, or if a pick is not
 * saved.
 */
test('a Groq key is stored and picked to hear dictation, with its model', async ({ page }) => {
  const owner = await provisionedUser('voicesettings');
  await signInAs(page, owner.user);

  await page.goto('/settings/model-providers');
  const groq = page.getByTestId('model-provider').filter({ hasText: 'Groq' });
  await expect(groq).toContainText('No key');
  await groq.getByRole('button', { name: 'Add key' }).click();
  const dialog = page.getByRole('dialog', { name: 'Groq key' });
  await dialog.getByLabel('API key').fill('gsk-e2e-secret-7731');
  await dialog.getByRole('button', { name: 'Save key' }).click();
  await expect(dialog).toBeHidden();
  await expect(groq).toContainText('Key ending in 7731');
  await expect(groq.getByRole('button', { name: 'Make default' })).toHaveCount(0);

  // Voice is the page's second tab, and the address says so.
  await page
    .getByRole('group', { name: 'Model providers views' })
    .getByRole('button', { name: 'Voice' })
    .click();
  await expect(page).toHaveURL(/[?&]tab=voice/);
  await expect(groq).toHaveCount(0);
  const row = page.getByTestId('voice-transcription');
  const provider = row.getByRole('button', { name: 'Speech-to-text provider' });
  await expect(provider).toContainText('Automatic');
  await provider.click();
  await page.getByRole('option', { name: 'Groq' }).click();
  await expect(provider).toContainText('Groq');

  const model = row.getByRole('button', { name: 'Speech-to-text model' });
  await expect(model).toContainText('Whisper large v3 Turbo');
  await model.click();
  await page.getByRole('option', { name: 'Whisper large v3', exact: true }).click();

  await expect
    .poll(async () => {
      const answer = await owner.api.get('/api/v1/voice/settings');
      const settings = (await answer.json()) as {
        transcriptionProvider: string | null;
        transcriptionModel: string | null;
        available: { transcription: string[] };
      };
      return [
        settings.transcriptionProvider,
        settings.transcriptionModel,
        settings.available.transcription.includes('groq'),
      ];
    })
    .toEqual(['groq', 'whisper-large-v3', true]);
  await owner.api.dispose();
});
