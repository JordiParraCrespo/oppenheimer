import { expect, test } from '@playwright/test';
import { expectProblemDocument, signedUpContext } from '../../support/auth';
import { query } from '../../support/db';

/**
 * A bot's form through the deployed API (`ask_form`), seeded as the tool
 * stores it: a card of its own, read at `GET /bots/:id/form`, submitted or
 * dismissed at its own routes and never through an approval's decision.
 * Values that do not fit the fields are `BOTS_047`; the values reach the
 * bot's next turn fenced and the chat as a `form` event; a second submission
 * is `BOTS_048`.
 */

interface Conversation {
  messages: {
    role: string;
    content: string;
    event: { kind: string; outcome: string; title: string; values: unknown[] } | null;
  }[];
}

test('a form is submitted at its own route, and the bot is told the values', async () => {
  const { api, userId } = await signedUpContext('botforms');
  const bot = (await (await api.post('/api/v1/bots', { data: { provider: 'glm' } })).json()) as {
    id: string;
  };
  const none = await api.get(`/api/v1/bots/${bot.id}/form`);
  expect(await none.json()).toEqual({ form: null });

  const [{ organizationId }] = await query<{ organizationId: string }>(
    'SELECT "organizationId" FROM bot WHERE id = $1',
    [bot.id],
  );
  // The bot's console chat, which its turns run in.
  await query(
    `INSERT INTO bot_conversation (id, "organizationId", "botId", kind)
     VALUES ($2, $1, $2, 'console') ON CONFLICT (id) DO NOTHING`,
    [organizationId, bot.id],
  );
  const [{ id: turnId }] = await query<{ id: string }>(
    `INSERT INTO bot_turn ("organizationId","botId","conversationId","requestedByUserId",provider,model,status,"startedAt","endedAt")
     VALUES ($1,$2,$2,$3,'glm','glm-5.3','completed',now(),now()) RETURNING id`,
    [organizationId, bot.id, userId],
  );
  const spec = {
    title: 'Release details',
    description: null,
    submitLabel: 'Cut it',
    fields: [
      {
        id: 'version',
        kind: 'text',
        label: 'Version',
        placeholder: null,
        required: true,
        default: null,
      },
      {
        id: 'replicas',
        kind: 'number',
        label: 'Replicas',
        placeholder: null,
        required: false,
        default: 2,
        min: 1,
        max: 5,
      },
    ],
  };
  const [{ id: formId }] = await query<{ id: string }>(
    `INSERT INTO bot_form ("organizationId","botId","turnId",spec,summary)
     VALUES ($1,$2,$3,$4,'Release details') RETURNING id`,
    [organizationId, bot.id, turnId, JSON.stringify(spec)],
  );

  const pending = await api.get(`/api/v1/bots/${bot.id}/form`);
  expect(await pending.json()).toMatchObject({
    form: {
      id: formId,
      status: 'pending',
      title: 'Release details',
      submitLabel: 'Cut it',
      fields: [
        { id: 'version', kind: 'text', required: true, min: null, options: null },
        { id: 'replicas', kind: 'number', default: 2, min: 1, max: 5 },
      ],
    },
  });
  // It is not an approval: nothing to approve.
  const approvals = await api.get(`/api/v1/bots/${bot.id}/approvals?status=pending`);
  expect(await approvals.json()).toEqual([]);

  const submit = (values: Record<string, unknown>) =>
    api.post(`/api/v1/bots/${bot.id}/forms/${formId}/submit`, { data: { values } });
  await expectProblemDocument(await submit({ version: 'v2', replicas: 9 }), {
    status: 422,
    code: 'BOTS_047',
  });
  await expectProblemDocument(await submit({ replicas: 3 }), { status: 422, code: 'BOTS_047' });
  const submitted = await submit({ version: 'v2.4.0', replicas: 3 });
  expect(submitted.status(), await submitted.text()).toBe(201);
  expect(await submitted.json()).toMatchObject({
    status: 'submitted',
    values: { version: 'v2.4.0', replicas: 3 },
  });
  await expectProblemDocument(await submit({ version: 'v3' }), { status: 409, code: 'BOTS_048' });

  const conversation = (await (
    await api.get(`/api/v1/bots/${bot.id}/conversation`)
  ).json()) as Conversation;
  const told = conversation.messages.find((message) => message.role === 'event');
  expect(told?.event).toEqual({
    kind: 'form',
    outcome: 'submitted',
    title: 'Release details',
    values: [
      { label: 'Version', value: 'v2.4.0' },
      { label: 'Replicas', value: '3' },
    ],
  });
  expect(told?.content).toContain('<values>');
  await api.dispose();
});

test('a form that is not the bot’s is BOTS_046', async () => {
  const { api } = await signedUpContext('botformsnone');
  const bot = (await (await api.post('/api/v1/bots', { data: { provider: 'glm' } })).json()) as {
    id: string;
  };
  await expectProblemDocument(
    await api.post(`/api/v1/bots/${bot.id}/forms/00000000-0000-4000-8000-000000000000/dismiss`, {
      data: {},
    }),
    { status: 404, code: 'BOTS_046' },
  );
  await api.dispose();
});
