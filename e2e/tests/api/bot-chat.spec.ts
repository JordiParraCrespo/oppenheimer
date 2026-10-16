import { expect, test } from '@playwright/test';
import { expectProblemDocument, signedUpContext } from '../../support/auth';

/**
 * A bot's chat through the deployed API (`product/versions/mvp/25-bots.md`
 * §2): a message to a bot whose provider has no key is refused; with a GLM key
 * (`GLM_API_KEY`, a real one, so the turn calls z.ai) a message becomes a
 * turn the worker runs, and the bot's answer is in the conversation, which
 * exports whole and clears (refused while the turn works). The live half is
 * skipped without the key.
 */

interface Conversation {
  messages: { role: string; content: string; turnId: string }[];
  turns: { id: string; status: string; error: string | null; outputTokens: number }[];
}

test.describe.configure({ timeout: 180_000 });

test('a message to a bot whose provider has no key is refused, with nothing queued', async () => {
  const { api } = await signedUpContext('botchatnokey');
  const bot = (await (await api.post('/api/v1/bots', { data: { provider: 'glm' } })).json()) as {
    id: string;
  };
  await expectProblemDocument(
    await api.post(`/api/v1/bots/${bot.id}/messages`, { data: { content: 'Hi' } }),
    { status: 409, code: 'BOTS_013' },
  );
  const conversation = (await (
    await api.get(`/api/v1/bots/${bot.id}/conversation`)
  ).json()) as Conversation;
  expect(conversation).toEqual({ messages: [], turns: [], messageCount: 0 });
  // An empty chat exports empty and clears to the same; another workspace's bot is not found.
  const exported = await api.get(`/api/v1/bots/${bot.id}/conversation/export`);
  expect(exported.status()).toBe(200);
  expect(await exported.json()).toEqual({ messages: [] });
  expect((await api.delete(`/api/v1/bots/${bot.id}/conversation`)).status()).toBe(204);
  await expectProblemDocument(
    await api.delete('/api/v1/bots/00000000-0000-4000-8000-000000000000/conversation'),
    { status: 404, code: 'BOTS_001' },
  );
  await api.dispose();
});

test('a GLM bot answers a message, end to end', async () => {
  const key = process.env.GLM_API_KEY;
  test.skip(!key, 'GLM_API_KEY is not set: the live turn needs a real key');
  const { api } = await signedUpContext('botchatglm');
  expect((await api.put('/api/v1/model-providers/glm', { data: { apiKey: key } })).status()).toBe(
    204,
  );
  const bot = (await (
    await api.post('/api/v1/bots', { data: { name: 'Echo Bot', provider: 'glm' } })
  ).json()) as { id: string };

  const sent = await api.post(`/api/v1/bots/${bot.id}/messages`, {
    data: { content: 'Reply with exactly the word: pineapple' },
  });
  expect(sent.status(), await sent.text()).toBe(202);
  const turn = (await sent.json()) as { id: string; status: string; model: string };
  expect(turn).toMatchObject({ status: 'queued', model: 'glm-5.3' });
  // Clear history waits for the turn: the model takes seconds to answer.
  await expectProblemDocument(await api.delete(`/api/v1/bots/${bot.id}/conversation`), {
    status: 409,
    code: 'BOTS_022',
  });

  await expect
    .poll(
      async () => {
        const conversation = (await (
          await api.get(`/api/v1/bots/${bot.id}/conversation`)
        ).json()) as Conversation;
        return conversation.turns.find((row) => row.id === turn.id)?.status;
      },
      { timeout: 150_000, intervals: [1_000] },
    )
    .toBe('completed');

  const conversation = (await (
    await api.get(`/api/v1/bots/${bot.id}/conversation`)
  ).json()) as Conversation;
  expect(conversation.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
  expect(conversation.messages[1].content.toLowerCase()).toContain('pineapple');
  expect(conversation.turns[0].outputTokens).toBeGreaterThan(0);

  const listed = (await (await api.get('/api/v1/bots')).json()) as {
    id: string;
    lastMessagePreview: string | null;
  }[];
  expect(listed.find((row) => row.id === bot.id)?.lastMessagePreview?.toLowerCase()).toContain(
    'pineapple',
  );
  expect(conversation).toMatchObject({ messageCount: 2 });

  // The export is the whole chat; Clear history erases it, and the sidebar's line with it.
  const exported = (await (
    await api.get(`/api/v1/bots/${bot.id}/conversation/export`)
  ).json()) as Pick<Conversation, 'messages'>;
  expect(exported.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
  expect((await api.delete(`/api/v1/bots/${bot.id}/conversation`)).status()).toBe(204);
  expect(await (await api.get(`/api/v1/bots/${bot.id}/conversation`)).json()).toEqual({
    messages: [],
    turns: [],
    messageCount: 0,
  });
  const cleared = (await (await api.get(`/api/v1/bots/${bot.id}`)).json()) as {
    lastMessagePreview: string | null;
  };
  expect(cleared.lastMessagePreview).toBeNull();
  await api.dispose();
});
