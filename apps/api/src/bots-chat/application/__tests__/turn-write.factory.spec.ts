import { randomUUID } from 'node:crypto';
import {
  type BotMessageRepositoryPort,
  UnstorableStepsError,
} from '../../database/bot-message.repository.port';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import { whatsappTurn } from '../../domain/bot-whatsapp-turn.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import type { BotChannelReplyResolver } from '../bot-channel-reply.resolver';
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
  const messages: Pick<
    BotMessageRepositoryPort,
    'insert' | 'saveSteps' | 'placeSteer' | 'removeTurnWords'
  > = {
    removeTurnWords: vi.fn().mockResolvedValue(undefined),
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
    { send: vi.fn() } as unknown as BotChannelReplyResolver,
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
  return { write, messages, stream, started, finished, turn };
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

  // What breaks this: a quiet turn's take-back announced as a message, so
  // the chat is told to draw a message that is gone.
  it('removes the words a quiet turn takes back, of that turn, and announces no message', async () => {
    const { write, messages, stream, turn } = setup(async () => undefined);
    const messageIds = [randomUUID()];
    await write({ kind: 'unsay', messageIds });

    expect(messages.removeTurnWords).toHaveBeenCalledWith(turn, messageIds);
    expect(stream.publish).not.toHaveBeenCalled();
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

/**
 * The owner's message on a channel hears from the bot as it works: what the
 * bot wrote goes to the chat once its next tool calls begin ("On it,
 * checking your sessions"), before the work rather than after it. A console
 * turn's words stay in the console, and a send that fails never fails the
 * turn.
 */
describe('TurnWriteFactory, a turn that sends as it goes', () => {
  const ids = { organizationId: randomUUID(), botId: randomUUID(), userId: randomUUID() };

  function channelSetup(turn: BotTurnEntity) {
    const messages: Pick<BotMessageRepositoryPort, 'insert' | 'saveSteps'> = {
      insert: vi.fn().mockResolvedValue(undefined),
      saveSteps: vi.fn().mockResolvedValue(undefined),
    };
    const stream = { write: vi.fn(), settle: vi.fn(), publish: vi.fn() };
    const channel = { send: vi.fn().mockResolvedValue(undefined) };
    const write = new TurnWriteFactory(
      messages as BotMessageRepositoryPort,
      stream as unknown as BotStreamPort,
      channel as unknown as BotChannelReplyResolver,
    ).writer(turn);
    const transcript = new TurnTranscript(turn);
    const run = (events: Parameters<TurnTranscript['apply']>[0][]) =>
      writeAll(
        write,
        events.flatMap((event) => transcript.apply(event)),
      );
    return { channel, run };
  }

  const ack = { type: 'text.done', text: 'On it, checking your sessions.' } as const;
  const call = { type: 'tool.started', callId: 'c1', name: 'list_sessions', input: {} } as const;

  function owners(): BotTurnEntity {
    return whatsappTurn(
      {
        organizationId: ids.organizationId,
        botId: ids.botId,
        requestedByUserId: ids.userId,
        provider: 'anthropic',
        model: 'claude-opus',
        effort: null,
      },
      {
        conversationId: randomUUID(),
        whatsappAccountId: randomUUID(),
        messageRowId: randomUUID(),
        text: 'Can you check my active sessions?',
        voiceNote: false,
      },
    ).turn;
  }

  // Breaks if the acknowledgement waits for the work to end (the two silent
  // minutes this was built to remove), or goes out before the bot moves on.
  it('sends the owner’s chat what the bot wrote once its tool calls begin, once', async () => {
    const turn = owners();
    const { channel, run } = channelSetup(turn);
    await run([ack]);
    expect(channel.send).not.toHaveBeenCalled();

    await run([call, { type: 'tool.started', callId: 'c2', name: 'list_hosts', input: {} }]);
    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(channel.send).toHaveBeenCalledWith(turn, 'On it, checking your sessions.', undefined);
  });

  // Breaks if a console turn's words reach a channel.
  it('sends nothing for a console turn', async () => {
    const turn = BotTurnEntity.queue({
      organizationId: ids.organizationId,
      botId: ids.botId,
      requestedByUserId: ids.userId,
      provider: 'anthropic',
      model: 'claude-opus',
      effort: null,
    });
    const { channel, run } = channelSetup(turn);
    await run([ack, call]);
    expect(channel.send).not.toHaveBeenCalled();
  });

  // Breaks if a channel that is down ends the work the person asked for.
  it('goes on when the send fails', async () => {
    const { channel, run } = channelSetup(owners());
    channel.send.mockRejectedValue(new Error('runner offline'));
    await expect(run([ack, call])).resolves.toBeUndefined();
  });
});
