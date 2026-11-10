import { type APIRequestContext, expect, test } from '@playwright/test';
import { expectProblemDocument, signedUpContext } from '../../support/auth';
import { query } from '../../support/db';
import {
  jidOf,
  type WhatsappInbound,
  WhatsappRunner,
  whatsappNumber,
} from '../../support/whatsapp-runner';

/**
 * A bot answers its owner on WhatsApp, over the deployed API and a runner
 * link (`product/next-steps/answering-on-telegram-and-whatsapp.md`, slice 3).
 * The host is `support/whatsapp-runner.ts`, which plays the runner and
 * WhatsApp both: every line the owner would see is a `whatsapp.send` frame it
 * records, so these tests read what reached the phone, not a row.
 *
 * Without `GLM_API_KEY` a turn fails for want of a key, and its failure line
 * is still sent as the reply: that proves the chain (outbox event, wake, the
 * worker, the reply job, the link) as well as an answer does. Only the
 * model's own answer is gated on the key.
 *
 * One host for the file, because pairing is throttled per address: the tests
 * run in order on one workspace, one spare number and one owner.
 */

test.describe.configure({ mode: 'serial' });

// A turn's reply waits on the bot worker, which can take minutes with a live model.
test.beforeEach(() => test.setTimeout(240_000));

interface Account {
  id: string;
  status: string;
  phone: string | null;
  answeringBotId: string | null;
  ownerNumber: string | null;
  ownerPendingNumber: string | null;
  ownerCodeExpiresAt: string | null;
}

interface Turn {
  id: string;
  conversationId: string;
  origin: string;
  botId: string;
  kind: string;
  whatsappAccountId: string | null;
  chatId: string | null;
  startsAtMessageId: string | null;
}

const FAILED_TURN = /^I could not finish that: /;
/** The bot answering on the number by default, and the one "Shop: …" switches to. */
const HELPER = 'Helper';
const SHOP = 'Shop';

let api: APIRequestContext;
let runner: WhatsappRunner;
let helperId: string;
let shopId: string;
let accountId: string;
/** The owner's personal number, and its chat with the spare one. */
const ownerNumber = whatsappNumber();
const owner = jidOf(ownerNumber);

async function accountOf(id: string): Promise<Account | undefined> {
  const accounts = (await (await api.get('/api/v1/whatsapp/accounts')).json()) as Account[];
  return accounts.find((account) => account.id === id);
}

async function createBot(name: string): Promise<string> {
  const created = await api.post('/api/v1/bots', { data: { name, provider: 'glm' } });
  expect(created.status(), await created.text()).toBe(201);
  return ((await created.json()) as { id: string }).id;
}

/** The turns a message queued, by the key that makes it one (`whatsappSourceKey`), with their conversation. */
async function turnsFor(message: WhatsappInbound): Promise<Turn[]> {
  return query<Turn & Record<string, unknown>>(
    `SELECT t.id, t."conversationId", t.origin, c."botId", c.kind, c."whatsappAccountId",
            c."chatId", c."startsAtMessageId"::text
       FROM whatsapp_message m
       JOIN bot_turn t ON t."sourceKey" = 'whatsapp:' || m."accountId" || ':' || m.id
       JOIN bot_conversation c ON c.id = t."conversationId"
      WHERE m."accountId" = $1 AND m."chatId" = $2 AND m."externalId" = $3`,
    [accountId, message.chatId, message.id],
  );
}

/** The one turn a message queued, once the outbox has woken its bot. */
async function turnOf(message: WhatsappInbound): Promise<Turn> {
  await expect
    .poll(async () => (await turnsFor(message)).length, {
      message: `the turn of "${message.text}"`,
    })
    .toBe(1);
  return (await turnsFor(message))[0] as Turn;
}

/** The order intake gave a stored message (`whatsapp_message.seq`). */
async function seqOf(message: WhatsappInbound): Promise<string> {
  const [row] = await query<{ seq: string }>(
    `SELECT seq::text FROM whatsapp_message WHERE "accountId" = $1 AND "chatId" = $2 AND "externalId" = $3`,
    [accountId, message.chatId, message.id],
  );
  return row?.seq ?? '';
}

/** Deliver the owner's message and wait for the reply that quotes it. */
async function ask(text: string, timeout = 150_000) {
  const message = runner.direct(owner, text);
  await runner.deliver([message]);
  const reply = await runner.waitForReplyTo(message, timeout);
  return { message, reply };
}

/** Long enough for a line the API owed to have reached the link, were it sent. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 3_000));

test.beforeAll(async () => {
  test.setTimeout(150_000);
  ({ api } = await signedUpContext('waowner'));
  const key = process.env.GLM_API_KEY;
  if (key) {
    expect((await api.put('/api/v1/model-providers/glm', { data: { apiKey: key } })).status()).toBe(
      204,
    );
  }
  helperId = await createBot(HELPER);
  shopId = await createBot(SHOP);
  runner = await WhatsappRunner.pair(api, `whatsapp-${Date.now()}`);
});

test.afterAll(async () => {
  runner?.close();
  await api?.dispose();
});

test('the owner confirms their number with the code it received, and a message gets one quoted reply outside the console chat', async () => {
  // Breaks when any link of the chain does while every unit still passes: the
  // code not reaching the named number, the outbox event not reaching
  // WakeOnWhatsapp, finish() not staging the reply for a WhatsApp turn, the
  // reply not quoting the owner's message, or the turn landing in the console.
  const linked = await api.post('/api/v1/whatsapp/accounts', {
    data: { hostId: runner.hostId, label: 'Spare' },
    failOnStatusCode: false,
  });
  expect(linked.status(), await linked.text()).toBe(201);
  accountId = ((await linked.json()) as Account).id;
  await expect
    .poll(async () => (await accountOf(accountId))?.status, { message: 'number connected' })
    .toBe('connected');
  expect((await accountOf(accountId))?.phone).toBe(runner.phone);

  const bound = await api.patch(`/api/v1/whatsapp/accounts/${accountId}`, {
    data: { answeringBotId: helperId },
    failOnStatusCode: false,
  });
  expect(bound.status(), await bound.text()).toBe(200);
  expect(await bound.json()).toMatchObject({ answeringBotId: helperId, ownerNumber: null });

  const named = await api.post(`/api/v1/whatsapp/accounts/${accountId}/owner`, {
    data: { phone: ownerNumber },
    failOnStatusCode: false,
  });
  expect(named.status(), await named.text()).toBe(202);
  expect(await named.json()).toMatchObject({ ownerPendingNumber: ownerNumber, ownerNumber: null });
  const codeLine = await runner.waitForSend(owner);
  const code = /\b(\d{6})\b/.exec(String(codeLine.text))?.[1] ?? '';
  expect(code).toMatch(/^\d{6}$/);
  expect(codeLine.replyTo).toBeUndefined();
  // The code is not kept where the bots read the chat.
  const kept = await query<{ text: string }>(
    `SELECT text FROM whatsapp_message WHERE "accountId" = $1 AND "chatId" = $2`,
    [accountId, owner],
  );
  expect(kept.map((row) => row.text).join('\n')).not.toContain(code);

  const wrong = code === '000000' ? '111111' : '000000';
  await expectProblemDocument(
    await api.post(`/api/v1/whatsapp/accounts/${accountId}/owner/confirm`, {
      data: { code: wrong },
      failOnStatusCode: false,
    }),
    { status: 422, code: 'WHATSAPP_011' },
  );
  const confirmed = await api.post(`/api/v1/whatsapp/accounts/${accountId}/owner/confirm`, {
    data: { code },
    failOnStatusCode: false,
  });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  expect(await confirmed.json()).toMatchObject({
    ownerNumber,
    ownerPendingNumber: null,
    answeringBotId: helperId,
  });

  const { message, reply } = await ask('Hi. Reply with exactly the word pineapple');
  expect(reply.replyTo).toEqual({ id: message.id, senderId: owner });
  if (process.env.GLM_API_KEY) {
    expect(String(reply.text).toLowerCase()).toContain('pineapple');
  } else {
    expect(reply.text).toMatch(FAILED_TURN);
  }
  await settle();
  expect(runner.repliesTo(message)).toHaveLength(1);

  const turn = await turnOf(message);
  expect(turn).toMatchObject({
    origin: 'whatsapp',
    kind: 'whatsapp',
    botId: helperId,
    whatsappAccountId: accountId,
    chatId: owner,
  });
  const chat = (await (await api.get(`/api/v1/bots/${helperId}/conversation`)).json()) as {
    messages: { content: string }[];
    turns: { id: string }[];
  };
  expect(chat.messages.map((row) => row.content)).not.toContain(message.text);
  expect(chat.turns.map((row) => row.id)).not.toContain(turn.id);
});

test('"Shop: …" is answered by Shop and the chat stays with Shop until another bot is named', async () => {
  // Breaks when the switch is lost: not resolved at intake, not stored on the
  // row, the next message read against the default again, or Shop's reply
  // dropped by the reply's "still the chat's bot" check.
  const { message: switched, reply } = await ask('Shop: what sold?');
  expect(reply.replyTo).toMatchObject({ id: switched.id });
  const shopTurn = await turnOf(switched);
  expect(shopTurn).toMatchObject({ botId: shopId, kind: 'whatsapp' });
  expect(shopTurn.startsAtMessageId).toBe(await seqOf(switched));

  const { message: next } = await ask('And yesterday?');
  const nextTurn = await turnOf(next);
  expect(nextTurn).toMatchObject({ botId: shopId, conversationId: shopTurn.conversationId });

  // A name that is no bot's is the owner's words, for the bot already answering.
  const { message: note } = await ask('Note: buy more stock');
  expect(await turnOf(note)).toMatchObject({ botId: shopId });

  // A bare "Name:" switches back with a line and wakes nobody.
  const back = runner.direct(owner, `${HELPER.toLowerCase()}:`);
  await runner.deliver([back]);
  expect((await runner.waitForReplyTo(back)).text).toBe(`Now talking to ${HELPER}.`);
  await settle();
  expect(await turnsFor(back)).toEqual([]);

  const { message: again } = await ask('Hello again');
  const helperTurn = await turnOf(again);
  expect(helperTurn.botId).toBe(helperId);
  expect(helperTurn.startsAtMessageId).toBe(await seqOf(back));
});

test('the owner’s /help, /new and /stop get their lines and queue no turn', async () => {
  // Breaks when intake stops calling answer() (the unit specs mock it), a
  // command reaches the model, or /new stops opening a fresh conversation.
  const help = runner.direct(owner, '/HELP');
  await runner.deliver([help]);
  const helpLine = await runner.waitForReplyTo(help);
  expect(helpLine.text).toMatch(new RegExp(`^${HELPER} answers here\\.`));
  expect(helpLine.text).toMatch(/\/new starts a fresh conversation/);

  const { message: before } = await ask('Before the new one');
  const old = await turnOf(before);

  const fresh = runner.direct(owner, '/new');
  await runner.deliver([fresh]);
  expect((await runner.waitForReplyTo(fresh)).text).toBe('Started a new conversation.');

  const { message: after } = await ask('After the new one');
  const next = await turnOf(after);
  expect(next.conversationId).not.toBe(old.conversationId);
  expect(next).toMatchObject({ botId: helperId, startsAtMessageId: await seqOf(fresh) });

  const stop = runner.direct(owner, '/stop');
  await runner.deliver([stop]);
  expect((await runner.waitForReplyTo(stop)).text).toBe('Stopping.');

  await settle();
  for (const command of [help, fresh, stop]) expect(await turnsFor(command)).toEqual([]);
});

test('a stranger, a group, the number’s own messages and its self-chat are kept and get nothing', async () => {
  // Breaks when the owner rule widens: a stranger answered (WhatsApp has no
  // stranger line), the owner answered in a group, a bot's own send or the
  // spare phone's typing read as the owner's, or the self-chat woken.
  const stranger = jidOf(whatsappNumber());
  const batch = [
    runner.direct(stranger, 'Hello?'),
    runner.direct(stranger, '/help'),
    runner.group('120363000000000001@g.us', owner, 'Hi from the group'),
    runner.group('120363000000000001@g.us', owner, '/new'),
    runner.direct(owner, 'Typed on the spare phone', { fromMe: true }),
    runner.selfChat('A note to self'),
  ];
  const from = runner.sends().length;
  expect(await runner.deliver(batch)).toEqual(batch.map((message) => message.key));
  await settle();
  expect(runner.sends().slice(from)).toEqual([]);
  for (const message of batch) {
    expect(await seqOf(message), `"${message.text}" is kept`).not.toBe('');
    expect(await turnsFor(message)).toEqual([]);
  }
});

test('a batch the host delivers twice, as after a dropped link, is acked both times and answered once', async () => {
  // Breaks when the runner's resend after a reconnect double-answers the
  // owner: insertMany's orIgnore staging the event again, UQ_bot_turn_source,
  // or the unretried reply job.
  const message = runner.direct(owner, 'Only once, please');
  expect(await runner.deliver([message])).toEqual([message.key]);
  expect(await runner.deliver([message])).toEqual([message.key]);

  await runner.waitForReplyTo(message, 150_000);
  await settle();
  expect(runner.repliesTo(message)).toHaveLength(1);
  expect(await turnsFor(message)).toHaveLength(1);
});

test('the number’s default bot is not deleted from under it, and another person’s bot is not its default', async () => {
  // Breaks when the delete guard is lost (BOTS_043), PATCH binds a bot the
  // caller cannot read, or a bot that has replied on WhatsApp cannot be
  // deleted once it is no default (its replies keep their row, the bot set null).
  await expectProblemDocument(
    await api.delete(`/api/v1/bots/${helperId}`, { failOnStatusCode: false }),
    { status: 409, code: 'BOTS_043' },
  );
  expect((await api.get(`/api/v1/bots/${helperId}`, { failOnStatusCode: false })).status()).toBe(
    200,
  );

  const { api: other } = await signedUpContext('waother');
  const theirs = (await (
    await other.post('/api/v1/bots', { data: { name: 'Not yours', provider: 'glm' } })
  ).json()) as { id: string };
  await other.dispose();
  await expectProblemDocument(
    await api.patch(`/api/v1/whatsapp/accounts/${accountId}`, {
      data: { answeringBotId: theirs.id },
      failOnStatusCode: false,
    }),
    { status: 404, code: 'BOTS_001' },
  );

  // Shop is only switched to, never the default: it goes, and the switch with it.
  expect((await api.delete(`/api/v1/bots/${shopId}`, { failOnStatusCode: false })).status()).toBe(
    204,
  );
  const unbound = await api.patch(`/api/v1/whatsapp/accounts/${accountId}`, {
    data: { answeringBotId: null },
    failOnStatusCode: false,
  });
  expect(unbound.status(), await unbound.text()).toBe(200);
  expect((await api.delete(`/api/v1/bots/${helperId}`, { failOnStatusCode: false })).status()).toBe(
    204,
  );
});
