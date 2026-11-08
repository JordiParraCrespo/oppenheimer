import { randomUUID } from 'node:crypto';
import {
  type BotMessageRepositoryPort,
  UnstorableStepsError,
} from '../../database/bot-message.repository.port';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { type TranscriptWrite, TurnTranscript, thrownFailure } from '../turn-transcript.policy';
import { TurnWriteFactory } from '../turn-write.factory';

/**
 * What a running turn does when Postgres refuses one of its writes (issue
 * #728): a call's result that cannot be stored fails that call alone, stored
 * with words the model reads in the history, and the turn goes on; any other
 * failed write ends the turn as a `storage` failure, never as the model
 * provider's. That a NUL or a lone surrogate is stored at all is the bots
 * chat integration suite's.
 */
const refused = () => new UnstorableStepsError(new Error('unsupported Unicode escape sequence'));

function setup(saveSteps: BotMessageRepositoryPort['saveSteps']) {
  const turn = BotTurnEntity.queue({
    organizationId: randomUUID(),
    botId: randomUUID(),
    requestedByUserId: randomUUID(),
    provider: 'anthropic',
    model: 'claude-opus',
    effort: null,
  });
  const messages: Pick<BotMessageRepositoryPort, 'insert' | 'saveSteps' | 'placeSteer'> = {
    insert: vi.fn().mockResolvedValue(undefined),
    saveSteps: vi.fn(saveSteps),
    placeSteer: vi.fn().mockResolvedValue(undefined),
  };
  const stream: Pick<BotStreamPort, 'write' | 'settle' | 'publish'> = {
    write: vi.fn().mockResolvedValue(undefined),
    settle: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
  };
  const write = new TurnWriteFactory(
    messages as BotMessageRepositoryPort,
    stream as unknown as BotStreamPort,
  ).writer(turn);
  const transcript = new TurnTranscript(turn);
  const started = transcript.apply({
    type: 'tool.started',
    callId: 'c1',
    name: 'read_mail_attachment',
    input: {},
  });
  const finished = transcript.apply({
    type: 'tool.finished',
    callId: 'c1',
    name: 'read_mail_attachment',
    output: 'Factura',
    isError: false,
  });
  return { write, messages, stream, started, finished };
}

async function writeAll(write: (w: TranscriptWrite) => Promise<void>, writes: TranscriptWrite[]) {
  for (const each of writes) await write(each);
}

describe('TurnWriteFactory', () => {
  // What breaks this: a refused call's end thrown up to the turn, so one
  // attachment's bytes end the whole turn and lose what came before it.
  it('fails only the call whose result Postgres refused, and stores and announces that', async () => {
    let calls = 0;
    const { write, messages, stream, started, finished } = setup(async () => {
      calls += 1;
      if (calls === 1) throw refused();
    });
    await writeAll(write, started);
    await writeAll(write, finished);

    expect(messages.saveSteps).toHaveBeenCalledTimes(2);
    const [line] = vi.mocked(messages.saveSteps).mock.calls[1];
    expect(line.steps[0]).toMatchObject({ callId: 'c1', isError: true });
    expect(line.steps[0].output).toContain('could not be saved');
    expect(line.steps[0].output).toContain('unsupported Unicode escape sequence');
    expect(stream.publish).toHaveBeenLastCalledWith(line.botId, {
      type: 'message',
      turnId: line.turnId,
      messageId: line.id,
    });
  });

  // What breaks this: a refused write read as `other`, which the chat draws
  // as "<provider> could not finish this turn".
  it('fails the turn as storage when the call cannot be stored even as failed', async () => {
    const { write, finished, started, stream } = setup(async () => {
      throw refused();
    });
    await writeAll(write, started);
    const failure = await writeAll(write, finished).catch((error: unknown) => error);

    expect(thrownFailure(failure)).toEqual({
      failure: 'storage',
      error: 'The turn could not be saved: unsupported Unicode escape sequence',
    });
    expect(stream.publish).toHaveBeenCalledTimes(1);
  });

  // What breaks this: any failed write read as the call's content, so a lost
  // connection stores a call as failed for good instead of failing the turn.
  it('fails the turn, not the call, when a steps write fails for another reason', async () => {
    const { write, messages, started, finished } = setup(async () => {
      throw new Error('Connection terminated unexpectedly');
    });
    await writeAll(write, started);
    const failure = await writeAll(write, finished).catch((error: unknown) => error);

    expect(thrownFailure(failure)).toEqual({
      failure: 'storage',
      error: 'The turn could not be saved: Connection terminated unexpectedly',
    });
    expect(messages.saveSteps).toHaveBeenCalledTimes(1);
  });

  it('fails the turn as storage when a new message is refused', async () => {
    const { write, messages, started } = setup(async () => undefined);
    vi.mocked(messages.insert).mockRejectedValue(refused());
    const failure = await writeAll(write, started).catch((error: unknown) => error);

    expect(thrownFailure(failure).failure).toBe('storage');
  });
});
