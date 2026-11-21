import { randomUUID } from 'node:crypto';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import { whatsappTurn } from '../../domain/bot-whatsapp-turn.policy';
import { BotChannelAsItGoesFactory } from '../bot-channel-as-it-goes.factory';
import type { BotChannelReplyResolver } from '../bot-channel-reply.resolver';
import { type TranscriptWrite, TurnTranscript } from '../turn-transcript.policy';

/**
 * The owner's message on a channel hears from the bot as it works: what the
 * bot wrote goes to the chat once its next tool calls begin ("On it,
 * checking your sessions"), before the work rather than after it. A console
 * turn's words stay in the console; a send that does not go is owed to the
 * next and never fails the turn.
 */
const ids = { organizationId: randomUUID(), botId: randomUUID(), userId: randomUUID() };
const engine = { provider: 'anthropic' as const, model: 'claude-opus', effort: null };

function owners(): BotTurnEntity {
  return whatsappTurn(
    {
      organizationId: ids.organizationId,
      botId: ids.botId,
      requestedByUserId: ids.userId,
      ...engine,
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

function setup(turn: BotTurnEntity) {
  const stored: TranscriptWrite[] = [];
  const channel = { send: vi.fn().mockResolvedValue(1) };
  const write = new BotChannelAsItGoesFactory(channel as unknown as BotChannelReplyResolver).wrap(
    turn,
    async (each) => {
      stored.push(each);
    },
  );
  const transcript = new TurnTranscript(turn);
  const run = async (events: Parameters<TurnTranscript['apply']>[0][]) => {
    for (const each of events.flatMap((event) => transcript.apply(event))) await write(each);
  };
  return { channel, run, stored };
}

const ack = { type: 'text.done', text: 'On it, checking your sessions.' } as const;
const call = (callId: string) =>
  ({ type: 'tool.started', callId, name: 'list_sessions', input: {} }) as const;
const done = (callId: string) =>
  ({ type: 'tool.finished', callId, name: 'list_sessions', output: '3', isError: false }) as const;

describe('BotChannelAsItGoesFactory', () => {
  // Breaks if the acknowledgement waits for the work to end (the two silent
  // minutes this was built to remove), goes out before the bot moves on, or
  // goes out twice.
  it('sends the owner’s chat what the bot wrote once its tool calls begin, once, after storing it', async () => {
    const turn = owners();
    const { channel, run, stored } = setup(turn);
    await run([ack]);
    expect(channel.send).not.toHaveBeenCalled();

    await run([call('c1'), call('c2'), done('c1')]);
    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(channel.send).toHaveBeenCalledWith(turn, 'On it, checking your sessions.', undefined);
    expect(stored.length).toBeGreaterThan(1);
  });

  // Breaks if a console turn's words reach a channel.
  it('hands a console turn’s writer back as it is', () => {
    const turn = BotTurnEntity.queue({
      organizationId: ids.organizationId,
      botId: ids.botId,
      requestedByUserId: ids.userId,
      ...engine,
    });
    const write = vi.fn();
    expect(new BotChannelAsItGoesFactory({} as BotChannelReplyResolver).wrap(turn, write)).toBe(
      write,
    );
  });

  // Breaks if a channel that is down ends the work the person asked for, or
  // if words that did not go are dropped rather than sent with the next.
  it('goes on when a send fails, and sends those words with the next run of calls', async () => {
    const { channel, run } = setup(owners());
    channel.send.mockRejectedValueOnce(new Error('runner offline')).mockResolvedValueOnce(0);
    await expect(run([ack, call('c1'), done('c1')])).resolves.toBeUndefined();
    await run([{ type: 'text.done', text: 'Two found so far.' }, call('c2'), done('c2')]);
    await run([call('c3')]);

    expect(channel.send.mock.calls.map(([, text]) => text)).toEqual([
      'On it, checking your sessions.',
      'On it, checking your sessions.\n\nTwo found so far.',
    ]);
  });
});
