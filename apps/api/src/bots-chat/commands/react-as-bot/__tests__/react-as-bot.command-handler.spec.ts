import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import { BotMessageEntity, type BotMessageProps } from '../../../domain/bot-message.entity';
import { ReactAsBotCommand } from '../react-as-bot.command';
import { ReactAsBotCommandHandler } from '../react-as-bot.command-handler';

/**
 * A bot's `react` tool, at its handler: it lands on the message that opened
 * the turn or the one named, only on the person's, only in the turn's own
 * conversation. Breaks if a bot can react in another chat, to its own words,
 * or writes when it reacts with what is already there.
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

function handlerOver(found: BotMessageEntity | null) {
  const messages: Pick<BotMessageRepositoryPort, 'findOne' | 'findOpening' | 'saveReaction'> = {
    findOne: vi.fn(async () => found),
    findOpening: vi.fn(async () => found),
    saveReaction: vi.fn(async () => undefined),
  };
  return { messages, handler: new ReactAsBotCommandHandler(messages as BotMessageRepositoryPort) };
}

const react = (emoji: string | null, messageId: string | null = null) =>
  new ReactAsBotCommand({
    scope,
    organizationId: 'org',
    botId: 'bot',
    conversationId: 'bot',
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
});
