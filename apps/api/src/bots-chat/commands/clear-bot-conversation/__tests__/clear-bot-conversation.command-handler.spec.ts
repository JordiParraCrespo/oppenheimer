import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import { BotEntity } from '../../../../bots/domain/bot.entity';
import { BotErrors } from '../../../../bots/domain/bots.errors';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { ClearBotConversationCommand } from '../clear-bot-conversation.command';
import { ClearBotConversationCommandHandler } from '../clear-bot-conversation.command-handler';

/**
 * Clear history (Settings → Profile): the bot's conversation is erased in
 * the bot's own workspace, and refused with `BOTS_022` while a turn is
 * queued or running. A bot the caller cannot see is `BOTS_001` and nothing
 * is cleared. What the clear deletes, and that it leaves another bot alone,
 * is the integration suite's.
 */
const scope: AccessScope = {
  userId: randomUUID(),
  organizationId: randomUUID(),
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function setup(outcome: 'cleared' | 'busy' | 'missing', options: { visible?: boolean } = {}) {
  const bot = BotEntity.createNew({
    organizationId: scope.organizationId as string,
    createdByUserId: scope.userId,
    name: 'Glm Bot',
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
    provider: 'glm',
  });
  const lookup: BotLookupPort = {
    bot: vi.fn(async () => {
      if (options.visible === false) throw new AppError(BotErrors.NOT_FOUND);
      return bot;
    }),
  };
  const turns = {
    clearConversation: vi.fn(async () => outcome),
  } satisfies Pick<BotTurnRepositoryPort, 'clearConversation'>;
  const handler = new ClearBotConversationCommandHandler(
    lookup,
    turns as unknown as BotTurnRepositoryPort,
  );
  const command = new ClearBotConversationCommand({ scope, botId: bot.id });
  return { bot, turns, handler, command };
}

describe('ClearBotConversationCommandHandler', () => {
  it("clears the bot's conversation in the bot's workspace and answers its id", async () => {
    const { bot, turns, handler, command } = setup('cleared');
    await expect(handler.execute(command)).resolves.toBe(bot.id);
    expect(turns.clearConversation).toHaveBeenCalledWith(bot.organizationId, bot.id);
  });

  it('refuses with BOTS_022 while a turn is queued or running', async () => {
    const { handler, command } = setup('busy');
    await expect(handler.execute(command)).rejects.toMatchObject({ code: 'BOTS_022' });
  });

  it('answers BOTS_001 for a bot deleted between the lookup and the clear', async () => {
    const { handler, command } = setup('missing');
    await expect(handler.execute(command)).rejects.toMatchObject({ code: 'BOTS_001' });
  });

  it('answers BOTS_001 for a bot the caller cannot see, and clears nothing', async () => {
    const { turns, handler, command } = setup('cleared', { visible: false });
    await expect(handler.execute(command)).rejects.toMatchObject({ code: 'BOTS_001' });
    expect(turns.clearConversation).not.toHaveBeenCalled();
  });
});
