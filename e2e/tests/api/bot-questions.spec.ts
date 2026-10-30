import { expect, test } from '@playwright/test';
import { expectProblemDocument, signedUpContext } from '../../support/auth';
import { query } from '../../support/db';

/**
 * A bot's card of questions through the deployed API (`ask_user`,
 * `product/versions/mvp/25-bots.md` §3.2), seeded as the tool stores it: a
 * card of its own, read at `GET /bots/:id/question`, answered or dismissed
 * at its own routes and never through an approval's decision. Answers that
 * do not fit are `BOTS_036`; the answers reach the bot's next turn fenced
 * and the chat as a `question` event; a second answer is `BOTS_037`.
 */

interface Conversation {
  messages: {
    role: string;
    content: string;
    event: { kind: string; outcome: string; summary: string; answers: unknown[] } | null;
  }[];
}

test('a card of questions is answered at its own route, and the bot is told the answers', async () => {
  const { api, userId } = await signedUpContext('botquestions');
  const bot = (await (await api.post('/api/v1/bots', { data: { provider: 'glm' } })).json()) as {
    id: string;
  };
  const none = await api.get(`/api/v1/bots/${bot.id}/question`);
  expect(await none.json()).toEqual({ question: null });

  const [{ organizationId }] = await query<{ organizationId: string }>(
    'SELECT "organizationId" FROM bot WHERE id = $1',
    [bot.id],
  );
  const [{ id: turnId }] = await query<{ id: string }>(
    `INSERT INTO bot_turn ("organizationId","botId","requestedByUserId",provider,model,status,"startedAt","endedAt")
     VALUES ($1,$2,$3,'glm','glm-5.3','completed',now(),now()) RETURNING id`,
    [organizationId, bot.id, userId],
  );
  const questions = [
    {
      header: 'Repo',
      question: 'Which repository should I release?',
      multiSelect: false,
      options: [
        { label: 'acme/web', description: null },
        { label: 'acme/api', description: null },
      ],
    },
  ];
  const [{ id: cardId }] = await query<{ id: string }>(
    `INSERT INTO bot_question ("organizationId","botId","turnId",questions,summary)
     VALUES ($1,$2,$3,$4,'Which repository should I release?') RETURNING id`,
    [organizationId, bot.id, turnId, JSON.stringify(questions)],
  );

  const pending = await api.get(`/api/v1/bots/${bot.id}/question`);
  expect(await pending.json()).toMatchObject({
    question: { id: cardId, status: 'pending', questions },
  });
  // It is not an approval: nothing to approve.
  const approvals = await api.get(`/api/v1/bots/${bot.id}/approvals?status=pending`);
  expect(await approvals.json()).toEqual([]);

  const answer = (answers: unknown[]) =>
    api.post(`/api/v1/bots/${bot.id}/questions/${cardId}/answer`, { data: { answers } });
  await expectProblemDocument(await answer([{ picks: [2], other: null }]), {
    status: 422,
    code: 'BOTS_036',
  });
  const answered = await answer([{ picks: [1], other: 'and tag it' }]);
  expect(answered.status(), await answered.text()).toBe(201);
  expect(await answered.json()).toMatchObject({
    status: 'answered',
    answers: [{ picks: [1], other: 'and tag it' }],
  });
  await expectProblemDocument(await answer([{ picks: [0], other: null }]), {
    status: 409,
    code: 'BOTS_037',
  });

  const conversation = (await (
    await api.get(`/api/v1/bots/${bot.id}/conversation`)
  ).json()) as Conversation;
  const told = conversation.messages.find((message) => message.role === 'event');
  expect(told?.event).toMatchObject({
    kind: 'question',
    outcome: 'answered',
    summary: 'Which repository should I release?',
    answers: [{ question: 'Which repository should I release?', answer: 'acme/api; “and tag it”' }],
  });
  expect(told?.content).toContain('<answers>');
  await api.dispose();
});

test('a card of questions that is not the bot’s is BOTS_035', async () => {
  const { api } = await signedUpContext('botquestionsnone');
  const bot = (await (await api.post('/api/v1/bots', { data: { provider: 'glm' } })).json()) as {
    id: string;
  };
  await expectProblemDocument(
    await api.post(
      `/api/v1/bots/${bot.id}/questions/00000000-0000-4000-8000-000000000000/dismiss`,
      { data: {} },
    ),
    { status: 404, code: 'BOTS_035' },
  );
  await api.dispose();
});
