import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { expectProblemDocument, signedUpContext } from '../../support/auth';

/**
 * A bot's Needs input cards through the deployed API
 * (`product/versions/mvp/25-bots.md` §5): a bot with none lists none, and a
 * decision on a card that is not the bot's is `BOTS_015`. With a GLM key
 * (`GLM_API_KEY`, a real one), a bot on Approve for me asked to start a
 * session raises a card instead of starting it; denying it with a note runs
 * nothing and gives the bot a turn opened by an event that says so, and a
 * second decision is `BOTS_016`. Approving one answers at once with the card
 * `approved` and no result: the call runs in a job, its answer lands on the
 * card (here a refusal, as the account has no host, so the card ends
 * failed), and the bot gets a turn opened by an event that says so. The live
 * half is skipped without the key.
 */

interface Approval {
  id: string;
  tool: string;
  summary: string;
  status: string;
  note: string | null;
  result: string | null;
}

interface Conversation {
  messages: {
    role: string;
    content: string;
    turnId: string;
    event: { kind: string; outcome: string; tool: string; summary: string } | null;
  }[];
  turns: { id: string; status: string }[];
}

test.describe.configure({ timeout: 240_000 });

test('a bot with no card lists none, and a decision on a card that is not its own is BOTS_015', async () => {
  const { api } = await signedUpContext('botapprovalsnone');
  const bot = (await (await api.post('/api/v1/bots', { data: { provider: 'glm' } })).json()) as {
    id: string;
  };
  const listed = await api.get(`/api/v1/bots/${bot.id}/approvals?status=pending`);
  expect(listed.status()).toBe(200);
  expect(await listed.json()).toEqual([]);
  await expectProblemDocument(
    await api.post(`/api/v1/bots/${bot.id}/approvals/${randomUUID()}/decision`, {
      data: { decision: 'approve' },
    }),
    { status: 404, code: 'BOTS_015' },
  );
  await api.dispose();
});

test('a start_session under Approve for me waits on a card, and a denial is reported back', async () => {
  const key = process.env.GLM_API_KEY;
  test.skip(!key, 'GLM_API_KEY is not set: the live turn needs a real key');
  const { api } = await signedUpContext('botapprovalsglm');
  expect((await api.put('/api/v1/model-providers/glm', { data: { apiKey: key } })).status()).toBe(
    204,
  );
  const bot = (await (
    await api.post('/api/v1/bots', { data: { name: 'Asker', provider: 'glm' } })
  ).json()) as { id: string; permission: string };
  expect(bot.permission).toBe('auto');

  const sent = await api.post(`/api/v1/bots/${bot.id}/messages`, {
    data: {
      content:
        'Call the start_session tool now with folder "/tmp" and task "echo hello". Do not ask me first.',
    },
  });
  expect(sent.status(), await sent.text()).toBe(202);

  const pending = async () =>
    (await (await api.get(`/api/v1/bots/${bot.id}/approvals?status=pending`)).json()) as Approval[];
  await expect
    .poll(async () => (await pending()).length, { timeout: 150_000, intervals: [1_000] })
    .toBe(1);
  const [card] = await pending();
  expect(card).toMatchObject({ tool: 'start_session', status: 'pending' });
  expect(card.summary).toContain('/tmp');

  const denied = await api.post(`/api/v1/bots/${bot.id}/approvals/${card.id}/decision`, {
    data: { decision: 'deny', note: 'Not on this machine' },
  });
  expect(denied.status(), await denied.text()).toBe(201);
  expect(await denied.json()).toMatchObject({ status: 'denied', note: 'Not on this machine' });
  await expectProblemDocument(
    await api.post(`/api/v1/bots/${bot.id}/approvals/${card.id}/decision`, {
      data: { decision: 'approve' },
    }),
    { status: 409, code: 'BOTS_016' },
  );

  await expect
    .poll(
      async () => {
        const conversation = (await (
          await api.get(`/api/v1/bots/${bot.id}/conversation`)
        ).json()) as Conversation;
        const event = conversation.messages.find((message) => message.role === 'event');
        return event
          ? conversation.turns.find((turn) => turn.id === event.turnId)?.status
          : undefined;
      },
      { timeout: 150_000, intervals: [1_000] },
    )
    .toBe('completed');
  const conversation = (await (
    await api.get(`/api/v1/bots/${bot.id}/conversation`)
  ).json()) as Conversation;
  const event = conversation.messages.find((message) => message.role === 'event');
  expect(event?.event).toMatchObject({
    kind: 'approval',
    outcome: 'denied',
    tool: 'start_session',
  });
  expect(event?.content).toContain('denied: ');
  expect(event?.content).toContain('Their note: Not on this machine');
  expect(await pending()).toEqual([]);
  await api.dispose();
});

test('approving a card answers at once, runs the call in its job, and the bot reports it', async () => {
  const key = process.env.GLM_API_KEY;
  test.skip(!key, 'GLM_API_KEY is not set: the live turn needs a real key');
  const { api } = await signedUpContext('botapprovalsyes');
  expect((await api.put('/api/v1/model-providers/glm', { data: { apiKey: key } })).status()).toBe(
    204,
  );
  const bot = (await (
    await api.post('/api/v1/bots', { data: { name: 'Asker', provider: 'glm' } })
  ).json()) as { id: string };
  const sent = await api.post(`/api/v1/bots/${bot.id}/messages`, {
    data: {
      content:
        'Call the start_session tool now with folder "/tmp" and task "echo hello". Do not ask me first.',
    },
  });
  expect(sent.status(), await sent.text()).toBe(202);
  const pending = async () =>
    (await (await api.get(`/api/v1/bots/${bot.id}/approvals?status=pending`)).json()) as Approval[];
  await expect
    .poll(async () => (await pending()).length, { timeout: 150_000, intervals: [1_000] })
    .toBe(1);
  const [card] = await pending();

  const approved = await api.post(`/api/v1/bots/${bot.id}/approvals/${card.id}/decision`, {
    data: { decision: 'approve' },
  });
  expect(approved.status(), await approved.text()).toBe(201);
  expect(await approved.json()).toMatchObject({ status: 'approved', result: null });

  // The account has no host: the call refuses, saying it needs one, so the card ends failed.
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
    .toContain('host');
  await expect
    .poll(
      async () => {
        const conversation = (await (
          await api.get(`/api/v1/bots/${bot.id}/conversation`)
        ).json()) as Conversation;
        const event = conversation.messages.find((message) => message.role === 'event');
        return event
          ? conversation.turns.find((turn) => turn.id === event.turnId)?.status
          : undefined;
      },
      { timeout: 150_000, intervals: [1_000] },
    )
    .toBe('completed');
  const conversation = (await (
    await api.get(`/api/v1/bots/${bot.id}/conversation`)
  ).json()) as Conversation;
  const event = conversation.messages.find((message) => message.role === 'event');
  expect(event?.event).toMatchObject({ kind: 'approval', outcome: 'failed' });
  expect(event?.content).toContain('approved: ');
  await api.dispose();
});
