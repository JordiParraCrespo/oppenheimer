import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import type {
  BotChannelReplyResolver,
  ChannelReactOutcome,
} from '../../../application/bot-channel-reply.resolver';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotMessageEntity, type BotMessageProps } from '../../../domain/bot-message.entity';
import { ReactAsBotCommand } from '../react-as-bot.command';
import { ReactAsBotCommandHandler } from '../react-as-bot.command-handler';

/**
 * A bot's `react` tool, at its handler: it lands on the message that opened
 * the turn or the one named, only on the person's, only in the turn's own
 * conversation; in a channel's conversation, on the channel's message too,
 * kept only once the channel took it. Breaks if a bot can react in another
 * chat, to its own words, writes when it reacts with what is already there,
 * or shows in the console a reaction the channel never got.
 */
const scope = { userId: 'u', organizationId: 'org' } as AccessScope;

const message = (props: Partial<BotMessageProps>) =>
  BotMessageEntity.createNew({
    organizationId: 'org',
    botId: 'bot',
    turnId: 'turn',
    role: 'user',
    content: 'Book the room',
    steps: [],
    position: 0,
    ...props,
  });

function handlerOver(
  found: BotMessageEntity | null,
  channel: { outcome?: ChannelReactOutcome; opening?: BotMessageEntity | null } = {},
) {
  const messages: Pick<BotMessageRepositoryPort, 'findOne' | 'findOpening' | 'saveReaction'> = {
    findOne: vi.fn(async () => found),
    findOpening: vi.fn(async () => (channel.opening === undefined ? found : channel.opening)),
    saveReaction: vi.fn(async () => undefined),
  };
  const turns: Pick<BotTurnRepositoryPort, 'findOne'> = {
    findOne: vi.fn(async () =>
      found?.turnId ? Some({ id: found.turnId, sourceKey: 'slack:key' } as never) : None,
    ),
  };
  const channels: Pick<BotChannelReplyResolver, 'react'> = {
    react: vi.fn(async () => channel.outcome ?? 'reacted'),
  };
  return {
    messages,
    channels,
    handler: new ReactAsBotCommandHandler(
      messages as BotMessageRepositoryPort,
      turns as BotTurnRepositoryPort,
      channels as BotChannelReplyResolver,
    ),
  };
}

const react = (emoji: string | null, messageId: string | null = null, conversationId = 'bot') =>
  new ReactAsBotCommand({
    scope,
    organizationId: 'org',
    botId: 'bot',
    conversationId,
    turnId: 'turn',
    messageId,
    emoji,
  });

describe('ReactAsBotCommandHandler', () => {
  it('reacts to the message that opened the turn when none is named', async () => {
    const opening = message({});
    const { handler, messages } = handlerOver(opening);
    await expect(handler.execute(react('👍'))).resolves.toEqual({
      kind: 'reacted',
      messageId: opening.id,
    });
    expect(messages.findOpening).toHaveBeenCalledWith('org', 'turn');
    expect(opening.botReaction).toBe('👍');
    expect(messages.saveReaction).toHaveBeenCalledWith(opening);
  });

  it('refuses a message of another conversation and writes nothing', async () => {
    const { handler, messages } = handlerOver(message({ conversationId: 'whatsapp-chat' }));
    await expect(handler.execute(react('👍', 'm1'))).resolves.toEqual({ kind: 'no_message' });
    expect(messages.saveReaction).not.toHaveBeenCalled();
  });

  it('refuses its own words and writes nothing', async () => {
    const { handler, messages } = handlerOver(message({ role: 'assistant', content: 'Done.' }));
    await expect(handler.execute(react('👍', 'm1'))).resolves.toEqual({ kind: 'not_yours' });
    expect(messages.saveReaction).not.toHaveBeenCalled();
  });

  it('writes nothing when the reaction is already the one there', async () => {
    const opening = message({ botReaction: '👍' });
    const { handler, messages } = handlerOver(opening);
    await handler.execute(react('👍'));
    expect(messages.saveReaction).not.toHaveBeenCalled();
  });

  it('reacts on the channel’s message a turn opened on, then keeps it', async () => {
    const opening = message({ conversationId: 'slack-thread', botReaction: '👍' });
    const { handler, messages, channels } = handlerOver(opening);
    await expect(handler.execute(react('🎉', 'm1', 'slack-thread'))).resolves.toEqual({
      kind: 'reacted',
      messageId: opening.id,
    });
    expect(channels.react).toHaveBeenCalledWith(
      {
        organizationId: 'org',
        conversationId: 'slack-thread',
        botId: 'bot',
        sourceKey: 'slack:key',
      },
      '🎉',
      '👍',
    );
    expect(opening.botReaction).toBe('🎉');
    expect(messages.saveReaction).toHaveBeenCalledWith(opening);
  });

  it('keeps nothing when the channel did not take it', async () => {
    const opening = message({ conversationId: 'whatsapp-chat' });
    const { handler, messages } = handlerOver(opening, { outcome: 'not_sent' });
    await expect(handler.execute(react('👍', 'm1', 'whatsapp-chat'))).resolves.toEqual({
      kind: 'not_sent',
    });
    expect(opening.botReaction).toBeNull();
    expect(messages.saveReaction).not.toHaveBeenCalled();
  });

  it('names no channel message for one folded into a turn another opened', async () => {
    const folded = message({ conversationId: 'whatsapp-chat' });
    const { handler, channels } = handlerOver(folded, {
      opening: message({ conversationId: 'whatsapp-chat' }),
      outcome: 'unreachable',
    });
    await handler.execute(react('👍', 'm1', 'whatsapp-chat'));
    expect(vi.mocked(channels.react).mock.calls[0]?.[0]).toMatchObject({ sourceKey: null });
  });
});
