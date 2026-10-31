import { randomUUID } from 'node:crypto';
import type { BotEngineEvent } from '@oppenheimer/backend-agents';
import { AppError } from '@oppenheimer/backend-core';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { MAIL_DRAFT_DATA_KEY } from '../../bot-mail-tool.mapper';
import { SHOWN_IMAGES_DATA_KEY } from '../../domain/bot-shown-image.policy';
import { SUBAGENT_DATA_KEY } from '../../domain/bot-subagent.policy';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import {
  failureKindOf,
  TIME_LIMIT_ERROR,
  type TranscriptWrite,
  TurnTranscript,
} from '../turn-transcript.policy';

/**
 * How a turn's engine events become the chat's messages: finished text is a
 * message, a run of tool calls between two of them is one activity line whose
 * steps fill in, the images a call showed are a message of the bot's after
 * its line, text as it streams is only passed on, and the outcome is the
 * engine's `done` with the usage summed.
 */
const turn = () =>
  BotTurnEntity.queue({
    organizationId: randomUUID(),
    botId: randomUUID(),
    requestedByUserId: randomUUID(),
    provider: 'glm',
    model: 'glm-5.3',
    effort: null,
  });

function run(events: BotEngineEvent[]) {
  const transcript = new TurnTranscript(turn());
  const writes: TranscriptWrite[] = events.flatMap((event) => transcript.apply(event));
  return { transcript, writes };
}

const inserted = (writes: TranscriptWrite[]) =>
  writes.flatMap((write) => (write.kind === 'insert' ? [write.message] : []));

describe('TurnTranscript', () => {
  it('passes streamed text on and stores each finished block as a message', () => {
    const { writes, transcript } = run([
      { type: 'text.delta', text: 'Hel' },
      { type: 'text.delta', text: 'lo' },
      { type: 'text.done', text: 'Hello' },
      { type: 'usage', inputTokens: 10, outputTokens: 2 },
      { type: 'done', reason: 'completed' },
    ]);
    expect(writes.filter((write) => write.kind === 'text')).toHaveLength(2);
    expect(
      inserted(writes).map((message) => [message.role, message.content, message.position]),
    ).toEqual([['assistant', 'Hello', 1]]);
    expect(transcript.result).toEqual({
      reason: 'completed',
      error: null,
      failure: null,
      inputTokens: 10,
      outputTokens: 2,
      context: null,
      planLimits: null,
    });
  });

  // What breaks this: a chat that reconnects mid-turn drawing a stored block
  // again, because the block it was told it is in counts one the conversation
  // never stored (only whitespace) or misses one it did.
  it('places each delta in the block it belongs to, counting only blocks it stored', () => {
    const { writes } = run([
      { type: 'text.delta', text: 'One' },
      { type: 'text.done', text: 'One' },
      { type: 'text.delta', text: '  ' },
      { type: 'text.done', text: '  ' },
      { type: 'tool.started', callId: 'a', name: 'web_search', input: {} },
      { type: 'text.delta', text: 'Two' },
      { type: 'done', reason: 'completed' },
    ]);
    expect(
      writes.flatMap((write) =>
        write.kind === 'text'
          ? [[write.block, write.text]]
          : write.kind === 'settled'
            ? ['settled']
            : [],
      ),
    ).toEqual([[0, 'One'], 'settled', [1, '  '], 'settled', [1, 'Two']]);
    expect(writes.findIndex((write) => write.kind === 'settled')).toBeGreaterThan(
      writes.findIndex((write) => write.kind === 'insert'),
    );
  });

  it('gathers a run of tool calls into one activity line and fills in what each answered', () => {
    const { writes } = run([
      { type: 'tool.started', callId: 'a', name: 'web_search', input: { q: 'x' } },
      { type: 'tool.started', callId: 'b', name: 'web_fetch', input: { url: 'u' } },
      { type: 'tool.finished', callId: 'a', name: 'web_search', output: 'found', isError: false },
      { type: 'tool.finished', callId: 'b', name: 'web_fetch', output: 'nope', isError: true },
      { type: 'text.done', text: 'Done.' },
      { type: 'tool.started', callId: 'c', name: 'web_search', input: {} },
      { type: 'done', reason: 'completed' },
    ]);
    const messages = inserted(writes);
    expect(messages.map((message) => [message.role, message.position])).toEqual([
      ['activity', 1],
      ['assistant', 2],
      ['activity', 3],
    ]);
    expect(messages[0].steps).toEqual([
      {
        callId: 'a',
        name: 'web_search',
        input: { q: 'x' },
        output: 'found',
        isError: false,
        sessionId: null,
        subagents: null,
        allowedBy: null,
        mailDraft: null,
      },
      {
        callId: 'b',
        name: 'web_fetch',
        input: { url: 'u' },
        output: 'nope',
        isError: true,
        sessionId: null,
        subagents: null,
        allowedBy: null,
        mailDraft: null,
      },
    ]);
  });

  it('keeps the session a call says it started on its step, never read from its words', () => {
    const { writes } = run([
      { type: 'tool.started', callId: 'a', name: 'start_session', input: {} },
      { type: 'tool.started', callId: 'b', name: 'start_session', input: {} },
      {
        type: 'tool.finished',
        callId: 'a',
        name: 'start_session',
        output: 'The agent is on it.',
        isError: false,
        data: { sessionId: 's-1' },
      },
      {
        type: 'tool.finished',
        callId: 'b',
        name: 'start_session',
        output: 'Started session s-2 on host h-1.',
        isError: false,
      },
    ]);
    const [activity] = inserted(writes);
    expect(activity.steps.map((step) => [step.callId, step.sessionId])).toEqual([
      ['a', 's-1'],
      ['b', null],
    ]);
  });

  it('keeps the draft a mail call saved on its step, and none from a draft it could not read', () => {
    const draft = {
      saved: 'created',
      draftId: 'd1',
      link: 'https://mail.google.com/mail/?authuser=ana%40acme.test#drafts?compose=dm1',
      mail: {
        kind: 'new',
        connectionId: '22222222-2222-4222-8222-222222222222',
        accountEmail: 'ana@acme.test',
        from: { email: 'ana@acme.test', name: null },
        to: ['bo@client.test'],
        cc: [],
        bcc: [],
        recipientsFromMail: false,
        subject: 'Invoice 42',
        body: 'Paid',
        signature: true,
        original: null,
        threadId: null,
        attachments: [],
        draftId: null,
        draftMessageId: null,
      },
    };
    const { writes } = run([
      { type: 'tool.started', callId: 'a', name: 'create_draft', input: {} },
      { type: 'tool.started', callId: 'b', name: 'create_draft', input: {} },
      {
        type: 'tool.finished',
        callId: 'a',
        name: 'create_draft',
        output: 'Draft saved',
        isError: false,
        data: { [MAIL_DRAFT_DATA_KEY]: JSON.stringify(draft) },
      },
      {
        type: 'tool.finished',
        callId: 'b',
        name: 'create_draft',
        output: 'Draft saved',
        isError: false,
        data: { [MAIL_DRAFT_DATA_KEY]: JSON.stringify({ draftId: 'd2' }) },
      },
    ]);
    const [activity] = inserted(writes);
    expect(activity.steps.map((step) => step.mailDraft)).toEqual([draft, null]);
  });

  it('keeps the subagents a delegate call ran on its step, and counts their tokens as the turn’s', () => {
    const runs = [
      {
        task: 'Check build-01',
        status: 'completed',
        result: 'Online',
        toolCalls: ['list_hosts'],
        inputTokens: 300,
        outputTokens: 40,
        durationMs: 2_000,
      },
      {
        task: 'Check build-02',
        status: 'failed',
        result: 'model overloaded',
        toolCalls: [],
        inputTokens: 50,
        outputTokens: 0,
        durationMs: 800,
      },
    ];
    const { writes, transcript } = run([
      { type: 'tool.started', callId: 'a', name: 'delegate', input: { tasks: [] } },
      { type: 'usage', inputTokens: 10, outputTokens: 2 },
      {
        type: 'tool.finished',
        callId: 'a',
        name: 'delegate',
        output: '2 subagents ran; 1 did not complete.',
        isError: false,
        data: { [SUBAGENT_DATA_KEY]: JSON.stringify(runs) },
      },
      { type: 'done', reason: 'completed' },
    ]);
    const [activity] = inserted(writes);
    expect(activity.steps[0]?.subagents).toEqual(runs);
    expect(transcript.result).toMatchObject({ inputTokens: 360, outputTokens: 42 });
  });

  it('keeps text a failed turn streamed but never finished, and says why it failed', () => {
    const { writes, transcript } = run([
      { type: 'text.delta', text: 'Half an ans' },
      { type: 'done', reason: 'failed', error: 'model overloaded', failure: 'unavailable' },
    ]);
    expect(inserted(writes).map((message) => message.content)).toEqual(['Half an ans']);
    expect(transcript.result).toMatchObject({
      reason: 'failed',
      error: 'model overloaded',
      failure: 'unavailable',
    });
  });

  it('passes a retry wait on to the stream and stores nothing for it', () => {
    const { writes, transcript } = run([
      { type: 'retrying', reason: 'rate_limit', delayMs: 30_000 },
      { type: 'done', reason: 'completed' },
    ]);
    expect(writes).toEqual([{ kind: 'retrying', reason: 'rate_limit' }]);
    expect(transcript.result.reason).toBe('completed');
  });

  // The chat says from the kind whether a retry can help; a failure the
  // engine did not name must still read as one, never as no failure.
  it('ends a failed turn with the kind of failure the engine named, other when it named none', () => {
    const named = turn();
    named.start(new Date());
    const transcript = new TurnTranscript(named);
    transcript.apply({ type: 'done', reason: 'failed', error: 'bad key', failure: 'credential' });
    transcript.endTurn(new Date(), null);
    expect(named.failure).toBe('credential');

    const unnamed = turn();
    unnamed.start(new Date());
    const quiet = new TurnTranscript(unnamed);
    quiet.apply({ type: 'done', reason: 'failed', error: 'odd' });
    quiet.endTurn(new Date(), null);
    expect(unnamed.failure).toBe('other');
  });

  it('puts the images a show_image call stored after its line, as the bot’s, and opens a new line for the next call', () => {
    const image = { id: randomUUID(), mimeType: 'image/png', sizeBytes: 68, name: 'Revenue' };
    const { writes } = run([
      { type: 'tool.started', callId: 'a', name: 'show_image', input: {} },
      {
        type: 'tool.finished',
        callId: 'a',
        name: 'show_image',
        output: 'Shown',
        isError: false,
        data: { [SHOWN_IMAGES_DATA_KEY]: JSON.stringify([image, { id: 7 }]) },
      },
      { type: 'tool.started', callId: 'b', name: 'web_fetch', input: {} },
      { type: 'tool.started', callId: 'c', name: 'show_image', input: {} },
      {
        type: 'tool.finished',
        callId: 'c',
        name: 'show_image',
        output: 'Refused',
        isError: true,
        data: { [SHOWN_IMAGES_DATA_KEY]: JSON.stringify([image]) },
      },
    ]);
    expect(
      inserted(writes).map((message) => [message.role, message.position, message.attachments]),
    ).toEqual([
      ['activity', 1, []],
      ['assistant', 2, [image]],
      ['activity', 3, []],
    ]);
  });

  it('fails a turn its time limit stopped, saying so, and keeps what it wrote', () => {
    const subject = turn();
    subject.start(new Date());
    const transcript = new TurnTranscript(subject);
    const writes = [
      { type: 'text.delta', text: 'Working on it' },
      { type: 'done', reason: 'cancelled' },
    ].flatMap((event) => transcript.apply(event as BotEngineEvent));
    transcript.endTurn(new Date(), 'time_limit');
    expect(inserted(writes).map((message) => message.content)).toEqual(['Working on it']);
    expect(subject.status).toBe('failed');
    expect(subject.error).toBe(TIME_LIMIT_ERROR);
    expect(subject.failure).toBe('time_limit');
  });

  // What breaks this: the meter reading the first answer's context, not the
  // last; a later usage event with no limits wiping the plan windows.
  it('ends the turn with the context of its last answer and the last plan limits said', () => {
    const subject = turn();
    subject.start(new Date());
    const transcript = new TurnTranscript(subject);
    const fiveHour = { usedPercent: 20.5, resetsAt: new Date(1_793_040_000_000) };
    const events: BotEngineEvent[] = [
      {
        type: 'usage',
        inputTokens: 10,
        outputTokens: 2,
        context: { tokens: 10, window: 200_000 },
        limits: { fiveHour, sevenDay: null },
      },
      { type: 'usage', inputTokens: 40, outputTokens: 5, context: { tokens: 40, window: 200_000 } },
      { type: 'done', reason: 'completed' },
    ];
    for (const event of events) transcript.apply(event);
    transcript.endTurn(new Date(), null);
    expect(subject.context).toEqual({ tokens: 40, window: 200_000 });
    expect(subject.planLimits).toEqual({ fiveHour, sevenDay: null });
  });

  it('ends a turn Stop cancelled as cancelled', () => {
    const subject = turn();
    subject.start(new Date());
    const transcript = new TurnTranscript(subject);
    transcript.apply({ type: 'done', reason: 'cancelled' });
    transcript.endTurn(new Date(), 'stop');
    expect(subject.status).toBe('cancelled');
    expect(subject.error).toBeNull();
  });

  it('cuts a long tool answer short', () => {
    const { writes } = run([
      { type: 'tool.started', callId: 'a', name: 'web_fetch', input: {} },
      {
        type: 'tool.finished',
        callId: 'a',
        name: 'web_fetch',
        output: 'x'.repeat(5000),
        isError: false,
      },
    ]);
    expect(inserted(writes)[0].steps[0].output).toHaveLength(2001);
  });
});

/**
 * A turn that throws before or around its engine: a provider with no key is
 * fixed in Settings (a retry cannot help), ChatGPT refreshing its sign-in
 * passes, anything else is not known.
 */
describe('failureKindOf', () => {
  it('reads a missing key as a credential failure and a refreshing sign-in as a passing one', () => {
    expect(failureKindOf(new AppError(BotErrors.PROVIDER_KEY_MISSING))).toBe('credential');
    expect(failureKindOf(new AppError(BotErrors.CHATGPT_REFRESHING))).toBe('unavailable');
    expect(failureKindOf(new AppError(BotErrors.NOT_FOUND))).toBe('other');
    expect(failureKindOf(new Error('boom'))).toBe('other');
  });
});
