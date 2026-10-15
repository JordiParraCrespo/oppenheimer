import { randomUUID } from 'node:crypto';
import type { BotEngineEvent } from '@oppenheimer/backend-agents';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import { TIME_LIMIT_ERROR, type TranscriptWrite, TurnTranscript } from '../turn-transcript.policy';

/**
 * How a turn's engine events become the chat's messages: finished text is a
 * message, a run of tool calls between two of them is one activity line whose
 * steps fill in, text as it streams is only passed on, and the outcome is the
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
      inputTokens: 10,
      outputTokens: 2,
    });
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
      { callId: 'a', name: 'web_search', input: { q: 'x' }, output: 'found', isError: false },
      { callId: 'b', name: 'web_fetch', input: { url: 'u' }, output: 'nope', isError: true },
    ]);
  });

  it('keeps text a failed turn streamed but never finished, and says why it failed', () => {
    const { writes, transcript } = run([
      { type: 'text.delta', text: 'Half an ans' },
      { type: 'done', reason: 'failed', error: 'model overloaded' },
    ]);
    expect(inserted(writes).map((message) => message.content)).toEqual(['Half an ans']);
    expect(transcript.result).toMatchObject({ reason: 'failed', error: 'model overloaded' });
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
