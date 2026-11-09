import { type APIRequestContext, expect, test } from '@playwright/test';
import { expectProblemDocument, signedUpContext } from '../../support/auth';
import { query } from '../../support/db';
import { TelegramRunner, telegramUserId } from '../../support/telegram-runner';

/**
 * A bot answers its owner on Telegram, over the deployed API and a runner
 * link (`product/next-steps/answering-on-telegram-and-whatsapp.md`). The host
 * is `support/telegram-runner.ts`, which plays the runner and Telegram both:
 * every line the owner or a stranger would see is a `telegram.send` frame it
 * records, so these tests read what reached the phone, not a row.
 *
 * Without `GLM_API_KEY` a turn fails for want of a key, and its failure line
 * is still sent as the reply: that proves the chain (outbox event, wake, the
 * worker, the reply job, the link) as well as an answer does. Only the
 * model's own answer is gated on the key.
 *
 * One host for the file, because pairing is throttled per address: the tests
 * run in order on one workspace, one Telegram bot and one owner.
 */

test.describe.configure({ mode: 'serial' });

// A turn's reply waits on the bot worker, which can take minutes with a live model.
test.beforeEach(() => test.setTimeout(240_000));

interface Account {
  id: string;
  status: string;
  username: string | null;
  answeringBotId: string | null;
  ownerLinked: boolean;
}

const TOKEN_TAIL = 'AAE2eTelegramTokenForTheFakeRunner01';
const FAILED_TURN = /^I could not finish that: /;

let api: APIRequestContext;
let runner: TelegramRunner;
let botId: string;
let accountId: string;
/** The code the owner linked with, spent once it did. */
let usedCode: string;
/** Telegram user A, the owner once the first test links them. */
const ownerId = telegramUserId();

async function accountOf(id: string): Promise<Account | undefined> {
  const accounts = (await (await api.get('/api/v1/telegram/accounts')).json()) as Account[];
  return accounts.find((account) => account.id === id);
}

async function connect(): Promise<Account> {
  const linked = await api.post('/api/v1/telegram/accounts', {
    data: { hostId: runner.hostId, token: `${runner.botId}:${TOKEN_TAIL}`, label: 'Phone' },
    failOnStatusCode: false,
  });
  expect(linked.status(), await linked.text()).toBe(201);
  return (await linked.json()) as Account;
}

async function answerAs(answeringBotId: string | null) {
  return api.patch(`/api/v1/telegram/accounts/${accountId}`, {
    data: { answeringBotId },
    failOnStatusCode: false,
  });
}

async function ownerLink(): Promise<{ url: string; expiresAt: string; code: string }> {
  const opened = await api.post(`/api/v1/telegram/accounts/${accountId}/owner-link`, {
    failOnStatusCode: false,
  });
  expect(opened.status(), await opened.text()).toBe(201);
  const body = (await opened.json()) as { url: string; expiresAt: string };
  const code = new URL(body.url).searchParams.get('start') ?? '';
  return { ...body, code };
}

/** The turn a Telegram message queued, by the key that makes it one (`telegramSourceKey`). */
async function turnsFor(chatId: string, messageId: string) {
  return query<{ id: string; conversationId: string; origin: string; status: string }>(
    `SELECT id, "conversationId", origin, status FROM bot_turn WHERE "sourceKey" = $1`,
    [`telegram:${accountId}:${chatId}:${messageId}`],
  );
}

/** Long enough for a line the API owed to have reached the link, were it sent. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 3_000));

test.beforeAll(async () => {
  test.setTimeout(150_000);
  ({ api } = await signedUpContext('telegramowner'));
  const key = process.env.GLM_API_KEY;
  if (key) {
    expect((await api.put('/api/v1/model-providers/glm', { data: { apiKey: key } })).status()).toBe(
      204,
    );
  }
  const created = await api.post('/api/v1/bots', {
    data: { name: 'Telegram Bot', provider: 'glm' },
  });
  expect(created.status(), await created.text()).toBe(201);
  botId = ((await created.json()) as { id: string }).id;
  runner = await TelegramRunner.pair(api, `telegram-${Date.now()}`);
});

test.afterAll(async () => {
  runner?.close();
  await api?.dispose();
});

test('the owner links with the one-time link and a message gets its turn’s answer as a reply, outside the console chat', async () => {
  // Breaks when any link of the chain does while every unit still passes: the
  // outbox event not reaching WakeOnTelegram, the reply job not processed, the
  // reply not routed to the host's link, or the turn landing in the console.
  const account = await connect();
  accountId = account.id;
  expect(runner.received('telegram.link')).toBe(true);
  await expect
    .poll(async () => (await accountOf(accountId))?.status, { message: 'account connected' })
    .toBe('connected');
  expect(await accountOf(accountId)).toMatchObject({
    username: runner.username,
    ownerLinked: false,
  });

  const bound = await answerAs(botId);
  expect(bound.status(), await bound.text()).toBe(200);
  expect(await bound.json()).toMatchObject({ answeringBotId: botId });

  const link = await ownerLink();
  expect(link.url).toMatch(new RegExp(`^https://t\\.me/${runner.username}\\?start=\\S+$`));
  const ttl = new Date(link.expiresAt).getTime() - Date.now();
  expect(ttl).toBeGreaterThan(9 * 60_000);
  expect(ttl).toBeLessThanOrEqual(10 * 60_000 + 5_000);

  const start = runner.direct(ownerId, `/start ${link.code}`);
  expect(await runner.sendMessages([start])).toEqual([start.key]);
  usedCode = link.code;
  const linked = await runner.waitForReplyTo(start);
  expect(linked.text).toMatch(/^Linked:/);
  expect((await accountOf(accountId))?.ownerLinked).toBe(true);

  const hi = runner.direct(ownerId, 'Hi. Reply with exactly the word: pineapple');
  await runner.sendMessages([hi]);
  const reply = await runner.waitForReplyTo(hi, 150_000);
  if (process.env.GLM_API_KEY) {
    expect(String(reply.text).toLowerCase()).toContain('pineapple');
  } else {
    expect(reply.text).toMatch(FAILED_TURN);
  }

  const [turn] = await turnsFor(ownerId, hi.id);
  expect(turn).toMatchObject({ origin: 'telegram' });
  expect(turn?.conversationId).not.toBe(botId);
  const conversation = (await (await api.get(`/api/v1/bots/${botId}/conversation`)).json()) as {
    messages: { content: string }[];
    turns: { id: string }[];
  };
  expect(conversation.messages.map((message) => message.content)).not.toContain(hi.text);
  expect(conversation.turns.map((row) => row.id)).not.toContain(turn?.id);
});

test('the owner’s /help, /new and /stop get their lines, strangers one line a day, groups and an unbound bot nothing that runs', async () => {
  // Breaks when intake stops calling answer() (the unit specs mock it), a
  // stranger is answered or spammed, a group triggers turns, a used link
  // links again, or /new and /stop reach the model.
  const help = runner.direct(ownerId, '/help');
  await runner.sendMessages([help]);
  const helpLine = await runner.waitForReplyTo(help);
  expect(helpLine.text).toMatch(/\/new starts a fresh conversation/);
  expect(await turnsFor(ownerId, help.id)).toEqual([]);

  const before = runner.direct(ownerId, 'Before the new one');
  await runner.sendMessages([before]);
  await expect.poll(async () => (await turnsFor(ownerId, before.id)).length).toBe(1);
  const [old] = await turnsFor(ownerId, before.id);
  await runner.waitForReplyTo(before, 150_000);

  const fresh = runner.direct(ownerId, '/new');
  await runner.sendMessages([fresh]);
  const newLine = await runner.waitForReplyTo(fresh);
  expect(newLine.text).toBe('Started a new conversation.');
  expect(await turnsFor(ownerId, fresh.id)).toEqual([]);

  const after = runner.direct(ownerId, 'After the new one');
  await runner.sendMessages([after]);
  await expect.poll(async () => (await turnsFor(ownerId, after.id)).length).toBe(1);
  const [next] = await turnsFor(ownerId, after.id);
  expect(next?.conversationId).not.toBe(old?.conversationId);
  const [conversation] = await query<{ startsAtMessageId: string; kind: string }>(
    `SELECT "startsAtMessageId"::text, kind FROM bot_conversation WHERE id = $1`,
    [next?.conversationId],
  );
  expect(conversation).toEqual({ startsAtMessageId: fresh.id, kind: 'telegram' });
  await runner.waitForReplyTo(after, 150_000);

  const stop = runner.direct(ownerId, '/stop');
  await runner.sendMessages([stop]);
  const stopLine = await runner.waitForReplyTo(stop);
  expect(stopLine.text).toBe('Stopping.');
  expect(await turnsFor(ownerId, stop.id)).toEqual([]);

  // A stranger is told once a day, and never by the model.
  const strangerId = telegramUserId();
  const first = runner.direct(strangerId, 'Hello?', 'Bea');
  await runner.sendMessages([first]);
  const strangerLine = await runner.waitForSend(strangerId);
  expect(strangerLine.text).toBe('This bot only talks to its owner.');
  await runner.sendMessages([runner.direct(strangerId, 'Anyone there?', 'Bea')]);
  // A code already spent links nobody, and is a stranger's message like any other.
  const [spent] = await query<{ ownerLinkCodeHash: string | null }>(
    `SELECT "ownerLinkCodeHash" FROM telegram_account WHERE id = $1`,
    [accountId],
  );
  expect(spent?.ownerLinkCodeHash).toBeNull();
  const replay = runner.direct(strangerId, `/start ${usedCode}`, 'Bea');
  await runner.sendMessages([replay]);
  await settle();
  expect(runner.sendsTo(strangerId)).toHaveLength(1);
  const [owner] = await query<{ ownerTelegramId: string }>(
    `SELECT "ownerTelegramId" FROM telegram_account WHERE id = $1`,
    [accountId],
  );
  expect(owner?.ownerTelegramId).toBe(ownerId);
  const strangerTurns = await query(`SELECT 1 FROM bot_turn WHERE "sourceKey" LIKE $1`, [
    `telegram:${accountId}:${strangerId}:%`,
  ]);
  expect(strangerTurns).toEqual([]);

  // The owner in a group is not answered there: groups are off.
  const groupId = `-100${telegramUserId()}`;
  const inGroup = runner.group(groupId, ownerId, 'Hi from the group');
  const stopInGroup = runner.group(groupId, ownerId, '/stop');
  await runner.sendMessages([inGroup, stopInGroup]);
  await settle();
  expect(runner.sendsTo(groupId)).toEqual([]);
  expect(await turnsFor(groupId, inGroup.id)).toEqual([]);

  // With no bot bound, the owner is told where to choose one, and nothing runs.
  expect((await answerAs(null)).status()).toBe(200);
  const unbound = runner.direct(ownerId, 'Is anyone answering?');
  await runner.sendMessages([unbound]);
  const noBot = await runner.waitForReplyTo(unbound);
  expect(noBot.text).toMatch(/^No bot answers here yet/);
  await settle();
  expect(await turnsFor(ownerId, unbound.id)).toEqual([]);
  expect((await answerAs(botId)).status()).toBe(200);
});

test('a batch the host sends twice, as after a dropped link, is acked both times and answered once', async () => {
  // Breaks when the runner's resend after a reconnect double-answers the owner:
  // UQ_bot_turn_source, insertMany's orIgnore or the unretried reply job.
  const message = runner.direct(ownerId, 'Only once, please');
  const batch = [message];
  expect(await runner.sendMessages(batch)).toEqual([message.key]);
  expect(await runner.sendMessages(batch)).toEqual([message.key]);

  await expect
    .poll(() => runner.sendsTo(ownerId).filter((frame) => frame.replyToId === message.id).length, {
      timeout: 150_000,
      message: 'the reply to the message',
    })
    .toBe(1);
  await settle();
  expect(runner.sendsTo(ownerId).filter((frame) => frame.replyToId === message.id)).toHaveLength(1);
  const turns = await turnsFor(ownerId, message.id);
  expect(turns).toHaveLength(1);
  expect(turns[0]?.origin).toBe('telegram');
});

test('the HTTP guards hold, a replaced link is dead, and disconnecting tells the host and keeps the Telegram history', async () => {
  // Breaks when the controller stops mapping 'answering' to BOTS_042 (tested
  // nowhere else), another person's bot can be bound, a replaced link still
  // links, or disconnect leaves the host polling or wipes the history.
  const { api: other } = await signedUpContext('telegramother');
  const theirs = (await (
    await other.post('/api/v1/bots', { data: { name: 'Not yours', provider: 'glm' } })
  ).json()) as { id: string };
  await expectProblemDocument(await answerAs(theirs.id), { status: 404, code: 'BOTS_001' });
  await other.dispose();
  expect((await accountOf(accountId))?.answeringBotId).toBe(botId);

  // A bot that answers on Telegram is not deleted from under it.
  const spare = (await (
    await api.post('/api/v1/bots', { data: { name: 'Spare', provider: 'glm' } })
  ).json()) as { id: string };
  expect((await answerAs(spare.id)).status()).toBe(200);
  await expectProblemDocument(
    await api.delete(`/api/v1/bots/${spare.id}`, { failOnStatusCode: false }),
    { status: 409, code: 'BOTS_042' },
  );
  expect((await api.get(`/api/v1/bots/${spare.id}`, { failOnStatusCode: false })).status()).toBe(
    200,
  );
  expect((await answerAs(null)).status()).toBe(200);
  expect((await api.delete(`/api/v1/bots/${spare.id}`, { failOnStatusCode: false })).status()).toBe(
    204,
  );
  expect((await answerAs(botId)).status()).toBe(200);

  // A second link replaces the first: the first code is a stranger's words.
  const first = await ownerLink();
  const second = await ownerLink();
  expect(second.code).not.toBe(first.code);
  const newcomer = telegramUserId();
  await runner.sendMessages([runner.direct(newcomer, `/start ${first.code}`, 'Cy')]);
  expect((await runner.waitForSend(newcomer)).text).toBe('This bot only talks to its owner.');
  await runner.sendMessages([runner.direct(newcomer, `/start ${second.code}`, 'Cy')]);
  expect((await runner.waitForSend(newcomer, 2)).text).toMatch(/^Linked:/);

  const conversations = await query<{ id: string }>(
    `SELECT id FROM bot_conversation WHERE "telegramAccountId" = $1`,
    [accountId],
  );
  expect(conversations.length).toBeGreaterThanOrEqual(2);

  const from = runner.frames.length;
  expect(
    (
      await api.delete(`/api/v1/telegram/accounts/${accountId}`, { failOnStatusCode: false })
    ).status(),
  ).toBe(204);
  await expect.poll(() => runner.received('telegram.unlink', from)).toBe(true);
  expect(await accountOf(accountId)).toBeUndefined();
  const kept = await query<{ id: string; telegramAccountId: string | null; chatId: string }>(
    `SELECT id, "telegramAccountId", "chatId" FROM bot_conversation WHERE id = ANY($1::uuid[])`,
    [conversations.map((row) => row.id)],
  );
  expect(kept).toHaveLength(conversations.length);
  for (const row of kept) expect(row).toMatchObject({ telegramAccountId: null, chatId: ownerId });

  // Until the host reports the bot's @username there is no link to open.
  runner.linkAnswer = 'connecting';
  accountId = (await connect()).id;
  await expectProblemDocument(
    await api.post(`/api/v1/telegram/accounts/${accountId}/owner-link`, {
      failOnStatusCode: false,
    }),
    { status: 409, code: 'TELEGRAM_007' },
  );
});
