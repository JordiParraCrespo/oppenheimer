import { createHmac, randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const SLACK_STUB = process.env.SLACK_STUB_URL ?? 'http://127.0.0.1:4322';

/** A Slack event to the bot's events address, signed with the app's secret as Slack signs it. */
async function slackEvent(botId: string, secret: string, event: Record<string, unknown>) {
  const body = JSON.stringify({ type: 'event_callback', team_id: 'T0STUB', event });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
  const response = await fetch(`${API_URL}/api/v1/slack/events?bot=${botId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature,
    },
    body,
  });
  expect(response.status).toBe(200);
}

/**
 * A bot's Slack app in a browser, against the real control plane and the
 * Slack stub (`e2e/support/slack-stub.ts`): connected from the bot's Gateways
 * page with a token and signing secret, the owner's Slack user linked by the
 * code the page makes and sent to the app as Slack would, and disconnected.
 * Who wakes the bot and where it answers is the API's (`slack-events.spec.ts`).
 */
test("a bot's Slack app from its Gateways page: connect, link the owner, disconnect", async ({
  page,
}) => {
  const owner = await provisionedUser('botslack');
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Juno', provider: 'glm' } })
  ).json()) as { id: string };
  const token = `xoxb-stub-${randomBytes(8).toString('hex')}`;
  const secret = randomBytes(16).toString('hex');
  await signInAs(page, owner.user);

  await page.goto(`/bots/${bot.id}/settings/gateways`);
  const slack = page.getByTestId('bot-slack-gateway');
  await expect(slack.getByTestId('slack-setup')).toBeVisible();
  const create = slack.getByRole('link', { name: 'Create in Slack' });
  await expect(create).toHaveAttribute('href', /^https:\/\/api\.slack\.com\/apps\?new_app=1/);
  expect(decodeURIComponent((await create.getAttribute('href')) ?? '')).toContain(
    `/api/v1/slack/events?bot=${bot.id}`,
  );

  await slack.getByLabel('Bot User OAuth Token').fill(token);
  await slack.getByLabel('Signing secret').fill(secret);
  await slack.getByRole('button', { name: 'Connect' }).click();
  const app = slack.getByTestId('slack-app');
  await expect(app).toContainText('@stub-bot');
  await expect(app).toContainText('Link your Slack user');

  await slack.getByRole('button', { name: 'Link my Slack user' }).click();
  const code = slack.getByTestId('slack-owner-link').locator('code');
  await expect(code).toHaveText(/^link \S+$/);
  await slackEvent(bot.id, secret, {
    type: 'message',
    channel_type: 'im',
    user: 'U0E2EOWNER',
    text: (await code.textContent()) ?? '',
    ts: '1700000000.000100',
    channel: 'D0E2E',
  });
  await slack.getByRole('button', { name: 'Check' }).click();
  await expect(app).toContainText('Answers you');
  await expect(slack.getByTestId('slack-owner-link')).toHaveCount(0);
  await expect
    .poll(async () => {
      const posts = (await (await fetch(`${SLACK_STUB}/_posts`)).json()) as {
        token: string;
        channel: string;
        text: string;
      }[];
      return posts.filter((post) => post.token === token).map((post) => post.channel);
    })
    .toEqual(['D0E2E']);

  await slack.getByRole('button', { name: 'Disconnect' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Disconnect' }).click();
  await expect(slack.getByTestId('slack-setup')).toBeVisible();
  expect(await (await owner.api.get('/api/v1/slack/accounts')).json()).toEqual([]);
});
