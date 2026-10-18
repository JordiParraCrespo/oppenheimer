import { expect, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';

/**
 * A bot creating a bot through the deployed API (`product/versions/mvp/25-bots.md`
 * §4.6, `create_bot`), with a real GLM key (`GLM_API_KEY`; skipped without
 * it). Under Full access the bot creates exactly one bot when asked: the
 * person's, marked as created by it, on its provider and model, under
 * Approve for me. Under Approve for me the call waits on a card naming the
 * bot, and approving it creates exactly that one bot.
 */

interface Bot {
  id: string;
  name: string;
  provider: string;
  model: string | null;
  permission: string;
  createdByBotId: string | null;
}

interface Approval {
  id: string;
  tool: string;
  summary: string;
  status: string;
  result: string | null;
}

test.describe.configure({ timeout: 240_000 });

async function glmWorkspace(prefix: string, key: string) {
  const { api } = await signedUpContext(prefix);
  expect((await api.put('/api/v1/model-providers/glm', { data: { apiKey: key } })).status()).toBe(
    204,
  );
  const bot = (await (
    await api.post('/api/v1/bots', { data: { name: 'Maker', provider: 'glm' } })
  ).json()) as Bot;
  const bots = async () => (await (await api.get('/api/v1/bots')).json()) as Bot[];
  return { api, bot, bots };
}

const ASK =
  'Call the create_bot tool exactly once now, with name "Scout" and description "Finds papers". Do not ask me first, and do not call it again.';

test('a bot under Full access asked to create a bot creates exactly one, yours, marked as its own', async () => {
  const key = process.env.GLM_API_KEY;
  test.skip(!key, 'GLM_API_KEY is not set: the live turn needs a real key');
  const { api, bot, bots } = await glmWorkspace('botcreatefull', key as string);
  const full = await api.patch(`/api/v1/bots/${bot.id}`, { data: { permission: 'full' } });
  expect(full.status(), await full.text()).toBe(200);

  const sent = await api.post(`/api/v1/bots/${bot.id}/messages`, { data: { content: ASK } });
  expect(sent.status(), await sent.text()).toBe(202);

  await expect
    .poll(async () => (await bots()).filter((row) => row.createdByBotId === bot.id).length, {
      timeout: 150_000,
      intervals: [1_000],
    })
    .toBe(1);
  // Let the turn finish, then check nothing more was made.
  await expect
    .poll(
      async () => {
        const conversation = (await (
          await api.get(`/api/v1/bots/${bot.id}/conversation`)
        ).json()) as { turns: { status: string }[] };
        return conversation.turns.at(-1)?.status;
      },
      { timeout: 150_000, intervals: [1_000] },
    )
    .toBe('completed');
  const made = (await bots()).filter((row) => row.createdByBotId === bot.id);
  expect(made).toHaveLength(1);
  expect(made[0]).toMatchObject({
    name: 'Scout',
    provider: 'glm',
    model: bot.model,
    permission: 'auto',
    createdByBotId: bot.id,
  });
  expect(await bots()).toHaveLength(2);
  await api.dispose();
});

test('under Approve for me the creation waits on a card, and approving it creates that one bot', async () => {
  const key = process.env.GLM_API_KEY;
  test.skip(!key, 'GLM_API_KEY is not set: the live turn needs a real key');
  const { api, bot, bots } = await glmWorkspace('botcreateask', key as string);
  expect(bot.permission).toBe('auto');

  const sent = await api.post(`/api/v1/bots/${bot.id}/messages`, { data: { content: ASK } });
  expect(sent.status(), await sent.text()).toBe(202);
  const pending = async () =>
    (await (await api.get(`/api/v1/bots/${bot.id}/approvals?status=pending`)).json()) as Approval[];
  await expect
    .poll(async () => (await pending()).length, { timeout: 150_000, intervals: [1_000] })
    .toBe(1);
  const [card] = await pending();
  expect(card).toMatchObject({ tool: 'create_bot', status: 'pending' });
  expect(card.summary).toContain('Create bot "Scout" on GLM');
  expect(await bots()).toHaveLength(1);

  const approved = await api.post(`/api/v1/bots/${bot.id}/approvals/${card.id}/decision`, {
    data: { decision: 'approve' },
  });
  expect(approved.status(), await approved.text()).toBe(201);
  await expect
    .poll(
      async () => {
        const all = (await (
          await api.get(`/api/v1/bots/${bot.id}/approvals`)
        ).json()) as Approval[];
        return all.find((row) => row.id === card.id)?.result ?? null;
      },
      { timeout: 60_000, intervals: [500] },
    )
    .toContain('Created bot');
  const made = (await bots()).filter((row) => row.createdByBotId === bot.id);
  expect(made).toHaveLength(1);
  expect(made[0]).toMatchObject({ name: 'Scout', provider: 'glm', permission: 'auto' });
  await api.dispose();
});
