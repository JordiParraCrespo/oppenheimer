import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { insertBotWebhookRoutine, webhookRun } from '../../support/db';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * A routine's webhook, from the Routines tab to a POST, against the real
 * control plane. The bot adds the trigger in chat (seeded here); the person
 * makes the URL and its signing secret on the tab, shown once, and anything
 * posted to it becomes a run of the routine, answered at once. What breaks
 * this: a signed URL that takes an unsigned request, a body that is not kept
 * with the run, a run that never reaches the bot, or a revoked URL that still
 * works.
 */
test("a routine's webhook URL, issued on the tab, posted to and revoked", async ({
  page,
  request,
}) => {
  const owner = await provisionedUser('botwebhook');
  await owner.api.put('/api/v1/model-providers/glm', { data: { apiKey: 'e2e-placeholder' } });
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Juno', provider: 'glm' } })
  ).json()) as { id: string };
  await insertBotWebhookRoutine(bot.id, 'Deploy watch', 'Tell me whether the deploy failed.');
  await signInAs(page, owner.user);

  await page.goto(`/bots/${bot.id}/settings/routines`);
  const card = page.locator('[data-slot="routine-card"]').filter({ hasText: 'Deploy watch' });
  await expect(card).toContainText('Webhook · Something posted to its URL');
  const row = page.getByTestId('routine-webhook');
  await expect(row).toContainText('no URL yet');

  // Create URL, signed: the URL and the secret are shown this once.
  await row.getByRole('button', { name: 'Create URL' }).click();
  const dialog = page.getByRole('dialog', { name: 'Webhook URL for “Deploy watch”' });
  await dialog.getByRole('checkbox').click();
  await dialog.getByRole('button', { name: 'Create URL' }).click();
  const codes = dialog.locator('pre code');
  await expect(codes).toHaveCount(2);
  const url = (await codes.nth(0).textContent()) ?? '';
  const secret = (await codes.nth(1).textContent()) ?? '';
  expect(url).toMatch(/\/api\/v1\/routine-webhooks\/owh_/);
  expect(secret).toMatch(/^owhsec_/);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(row).toContainText('Signed');
  await expect(row).toContainText('nothing received yet');
  await expect(row).not.toContainText(url.split('/').pop() ?? url);

  // Unsigned is refused; signed runs the routine, answered with the run.
  const body = '{"deploy":"web","status":"failed"}';
  const unsigned = await request.post(url, {
    data: body,
    headers: { 'content-type': 'application/json' },
  });
  expect(unsigned.status()).toBe(401);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const signed = await request.post(url, {
    data: body,
    headers: { 'content-type': 'application/json', 'x-oppenheimer-signature': `t=${t},v1=${v1}` },
  });
  expect(signed.status()).toBe(202);
  const answer = (await signed.json()) as { runId: string; status: string };
  expect(answer.status).toBe('queued');

  // The body is kept with the run, and the run becomes a turn of the bot.
  await expect
    .poll(async () => (await webhookRun(answer.runId))?.webhookPayload)
    .toMatchObject({ body, contentType: 'application/json', bodyTruncated: false });
  await expect.poll(async () => (await webhookRun(answer.runId))?.botTurnId).toBeTruthy();
  await page.reload();
  await expect(row).toContainText('last received');

  // Revoked, the URL answers 404 and the row offers a new one.
  await row.getByRole('button', { name: 'Revoke' }).click();
  const confirm = page.getByRole('alertdialog', {
    name: 'Revoke the webhook URL of “Deploy watch”?',
  });
  await confirm.getByRole('button', { name: 'Revoke' }).click();
  await expect(confirm).toBeHidden();
  await expect(row).toContainText('no URL yet');
  const after = await request.post(url, {
    data: body,
    headers: { 'content-type': 'application/json', 'x-oppenheimer-signature': `t=${t},v1=${v1}` },
  });
  expect(after.status()).toBe(404);
});
