/**
 * The prompt-strings check, case by case: what counts as a sentence for a
 * model, where a literal cannot be one, and how the ledger excuses and expires.
 * Each case is the regression it stops: a sentence slipping back into a
 * policy unseen, or the check crying wolf at an error message until someone
 * switches it off.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check, excusedIn, LEDGER, sentencesIn } from './check-prompt-strings.mjs';

const starts = (text) => sentencesIn(text).map((sentence) => sentence.text.slice(0, 24));

test('a sentence in a string, a template or a list of lines is found, once each', () => {
  assert.deepEqual(
    starts(`
      export function answer(name: string) {
        return 'Not sent: the message was empty, so nothing was written.';
      }
      const line = \`Session \${name} is still working after a while, so wait again.\`;
      const prompt = [
        'You check one action against rules.',
        'Answer with JSON only, no prose at all.',
      ].join('\\n');
    `),
    ['Not sent: the message wa', 'Session   is still worki', 'You check one action aga'],
  );
});

test("a tool's description and a parameter's are sentences for a model", () => {
  assert.equal(
    sentencesIn(`
      const input = z.object({ id: z.string().describe('The session to read, from list_sessions.') });
      const tool = { name: 'read', description: 'Reads what a session did, newest last, as data.' };
    `).length,
    2,
  );
});

test('a label, a key and a short phrase are not sentences', () => {
  assert.deepEqual(
    starts(`
      const COLUMNS = { todo: 'Not started', doing: 'In progress' };
      const key = 'subscription:session:task';
      const phrase = 'was marked done';
    `),
    [],
  );
});

test('a literal where no model reads it is not counted', () => {
  assert.deepEqual(
    starts(`
      import { thing } from './a/long/path/with words in it somewhere';
      type Reason = 'the owner wrote to the bot instead of answering';
      throw new ArgumentInvalidException('A loop runs every 1 minute to 1 day, no more');
      throw new Error('This should never happen in a running turn at all');
      this.logger.warn('Could not keep a bot turn in the stream this time');
      await manager.query('select the turns that are still running for this bot', [status]);
      if (reason === 'the turn ended without saying why it did') stop();
      const words = promptText('tools/x.y', { name: 'a name with more than four words in it here' });
      outbox.stageJob(manager, { topic: 'checks', reason: 'bot handed a session task: check on how it goes' });
      class X { @ApiOperation({ summary: 'Lists the bots of a workspace, newest first' }) list() {} }
      const tool = { summarize: (input) => \`Move \${input.count} messages to Trash in the inbox\` };
    `),
    [],
  );
});

test('what is passed over is passed over for a named place, the nearest one', () => {
  assert.deepEqual(
    excusedIn(`
      throw new ArgumentInvalidException('A loop runs every 1 minute to 1 day, no more');
      this.logger.warn('Could not keep a bot turn in the stream this time');
      outbox.stageJob(manager, { topic: 'checks', reason: 'bot handed a session task: check on how it goes' });
      const tool = { summarize: (input) => \`Move \${input.count} messages to Trash in the inbox\` };
      if (reason === 'the turn ended without saying why it did') stop();
      const tool2 = { summarize: () => { throw new Error('No card line can be written for this tool'); } };
    `).map((literal) => literal.place),
    [
      "an exception's message, a pattern or a domain event",
      "a log line, a query or a prompt's id",
      "an outbox row's reason",
      "the line on the person's approval card",
      'a comparison',
      "an exception's message, a pattern or a domain event",
    ],
  );
});

test('a statement is SQL; a sentence that opens with one of its words is a sentence', () => {
  assert.deepEqual(
    starts(`
      const a = 'UPDATE "bot_turn" SET "status" = $1 WHERE "id" = $2 AND "status" = $3';
      const b = 'SELECT "id" FROM "bot_turn" WHERE "bot_id" = $1 ORDER BY "created_at"';
      const c = 'UPDATE: the session ended while you were away, so read its last message.';
      const d = 'DELETE nothing the person did not name, and say what you kept.';
    `),
    ['UPDATE: the session ende', 'DELETE nothing the perso'],
  );
});

test('four words and 28 characters make a sentence; one fewer of either does not', () => {
  assert.deepEqual(
    starts(`
      const a = 'Tell them what you did now.';
      const b = 'Tell them what you did nowx.';
      const c = 'Internationalisation happened yesterday.';
    `),
    ['Tell them what you did n'],
  );
});

test('a call excuses what is handed to it, not a sentence inside a callback', () => {
  assert.deepEqual(
    starts(`
      this.logger.warn({ message: 'Could not keep a bot turn in the stream this time' });
      await manager.query(sql, names.map((name) => 'The session is late: check on it and tell the person.'));
      this.logger.debug(() => say('The session is late: look at it and say so to them.'));
    `),
    ['The session is late: che', 'The session is late: loo'],
  );
});

test("a tool's card line is not counted, but a refusal thrown while building it is", () => {
  assert.deepEqual(
    starts(`
      const tool = {
        summarize: (input) => {
          if (!input.host) throw new BotToolRefusal('No host named and you have no home host: ask which.');
          return \`Start a session on \${input.host} for the task they asked about\`;
        },
      };
    `),
    ['No host named and you ha'],
  );
});

test('a refusal a tool throws is found: the model reads it', () => {
  assert.equal(
    sentencesIn(
      `throw new BotToolRefusal('No host named and you have no home host: ask which one.');`,
    ).length,
    1,
  );
});

const policy = {
  file: 'bots-chat/domain/bot-x.policy.ts',
  text: `export const A = 'Done, with nothing to say here. The console has it.';\nexport const B = 'Tell the person the task never ran, and why.';`,
};

test('a sentence outside the ledger is reported with its file and line', () => {
  const { outstanding, stale } = check([policy], []);
  assert.deepEqual(
    outstanding.map(({ file, line }) => `${file}:${line}`),
    ['bots-chat/domain/bot-x.policy.ts:1', 'bots-chat/domain/bot-x.policy.ts:2'],
  );
  assert.deepEqual(stale, []);
});

test('an entry excuses the sentence it names and no other in the file', () => {
  const ledger = [{ file: policy.file, starts: 'Done, with nothing', why: 'sent to the person' }];
  const { outstanding, stale } = check([policy], ledger);
  assert.deepEqual(
    outstanding.map(({ line }) => line),
    [2],
  );
  assert.deepEqual(stale, []);
});

test('an entry without a start excuses the whole file', () => {
  const { outstanding } = check(
    [policy],
    [{ file: policy.file, why: 'none of it is for a model' }],
  );
  assert.deepEqual(outstanding, []);
});

test('an entry that matches nothing is reported, so the ledger cannot outlive its reason', () => {
  const ledger = [{ file: policy.file, starts: 'A sentence that was moved', why: 'gone' }];
  assert.deepEqual(check([policy], ledger).stale, ledger);
});

test('every entry of the ledger says why', () => {
  assert.ok(LEDGER.length > 0);
  for (const entry of LEDGER) {
    assert.ok(entry.why.length >= 10, `${entry.file}: an entry says why it is not for a model`);
  }
});
