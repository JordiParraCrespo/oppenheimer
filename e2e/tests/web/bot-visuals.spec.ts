import { expect, test } from '@playwright/test';
import { insertBotActivity } from '../../support/db';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * A visual a bot drew with `show_visual`, in a browser against the real
 * control plane: the step the API stored with its visual comes back through
 * the conversation and the chat draws it as a card, with the tool calls
 * hidden as they are by default. What breaks this: the visual dropped between
 * the stored step and the console (the mapper, the response, the client's
 * check), so the bot says "shown" and the person sees nothing. How a turn comes
 * to store it is the API's unit specs; no model runs here.
 */
test('draws the visual a bot showed as a card in its chat', async ({ page }) => {
  const owner = await provisionedUser('botvisual');
  await owner.api.put('/api/v1/model-providers/glm', { data: { apiKey: 'e2e-placeholder' } });
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Release Bro', provider: 'glm' } })
  ).json()) as { id: string };
  await insertBotActivity(bot.id, [
    {
      callId: 'v',
      name: 'show_visual',
      input: {},
      output: 'Shown to the person: "Release health", metrics, table.',
      isError: false,
      sessionId: null,
      subagents: null,
      allowedBy: null,
      mailDraft: null,
      rateLimit: null,
      visual: {
        title: 'Release health',
        blocks: [
          { type: 'metrics', items: [{ label: 'Deploys', value: 'thirty-eight' }] },
          {
            type: 'table',
            columns: [{ label: 'Service' }, { label: 'Errors' }],
            rows: [
              ['api', 4],
              ['web', 19],
            ],
          },
        ],
      },
    },
  ]);

  await signInAs(page, owner.user);
  await page.goto(`/bots/${bot.id}`);
  const card = page.locator('[data-slot="visual"]');
  await expect(card).toContainText('Release health');
  await expect(card).toContainText('thirty-eight');
  // The table sorts by a click on its header, largest first for numbers.
  await card.getByRole('button', { name: 'Errors' }).click();
  await expect(card.getByRole('row').nth(1)).toContainText('web');
});
