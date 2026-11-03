import { expect, test } from '@playwright/test';
import { insertBotActivity } from '../../support/db';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * A call a system's rate limit stopped, in a browser against the real control
 * plane (`product/versions/mvp/25-bots.md` §4, "Rate limits"): the step the
 * API stored with its limit comes back through the conversation and the chat
 * draws it as a wait with its system and time, not as a failure. What breaks
 * this: the limit dropped between the stored step and the console (the
 * mapper, the response, the client), so the line reads "failed" in red again.
 * How a turn comes to store the limit is the API's unit specs; no model or
 * Gmail is run here.
 */
test('draws a step a rate limit stopped as a wait with its time, not as failed', async ({
  page,
}) => {
  const owner = await provisionedUser('botlimit');
  await owner.api.put('/api/v1/model-providers/glm', { data: { apiKey: 'e2e-placeholder' } });
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Mail Bro', provider: 'glm' } })
  ).json()) as { id: string };
  const step = {
    name: 'archive_mail',
    input: { account: 'me@example.com', thread_ids: ['t1'] },
    sessionId: null,
    subagents: null,
    allowedBy: null,
    mailDraft: null,
  };
  await insertBotActivity(bot.id, [
    {
      ...step,
      callId: 'a',
      output: 'Archived: 10 changed.',
      isError: false,
      rateLimit: null,
    },
    {
      ...step,
      callId: 'b',
      output:
        'MAIL_008: Gmail is limiting our requests until 2026-11-02T10:02:00.000Z (in about 60 s), and stopped this call there.',
      isError: true,
      rateLimit: { system: 'Gmail', resetAt: '2026-11-02T10:02:00.000Z' },
    },
  ]);

  await signInAs(page, owner.user);
  await page.goto(`/bots/${bot.id}`);
  const group = page.getByRole('button', { name: /Used 2 tools|Archived/ });
  await expect(group).toBeVisible();
  await expect(group).not.toContainText('failed');
  await group.click();
  const limited = page.getByRole('listitem').filter({ hasText: /Gmail limit · until/ });
  await expect(limited).toBeVisible();
  await expect(limited).toHaveAttribute('data-tone', 'default');
  await expect(page.getByRole('listitem').filter({ hasText: 'failed' })).toHaveCount(0);
});
