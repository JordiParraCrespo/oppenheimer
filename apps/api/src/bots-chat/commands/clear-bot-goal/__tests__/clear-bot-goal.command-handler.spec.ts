/**
 * The owner stops a bot's goal (`25-bots.md` §4.1). What breaks this: a
 * stop leaving no trace in the chat; a bot in another workspace reached. The
 * waiting continuation it cancels is `BotGoalResolver`'s, specced there.
 */
import { emptyScope } from '../../../../authz/domain/access-scope.types';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import type { BotGoalResolver } from '../../../application/bot-goal.resolver';
import type { BotGoalRepositoryPort } from '../../../database/bot-goal.repository.port';
import { BotGoalEntity } from '../../../domain/bot-goal.entity';
import { ClearBotGoalCommand } from '../clear-bot-goal.command';
import { ClearBotGoalCommandHandler } from '../clear-bot-goal.command-handler';

const scope = emptyScope('owner-1', 'org-1');

function setup(stored: BotGoalEntity | null) {
  const lookup = {
    bot: vi.fn<BotLookupPort['bot']>(
      async () => ({ id: 'bot-1', organizationId: 'org-1' }) as unknown as BotEntity,
    ),
  };
  const goals = {
    findForBot: vi.fn<BotGoalRepositoryPort['findForBot']>(async () => stored),
  } satisfies Partial<BotGoalRepositoryPort>;
  const goalsOf = { end: vi.fn<BotGoalResolver['end']>(async () => true) };
  const handler = new ClearBotGoalCommandHandler(
    lookup as unknown as BotLookupPort,
    goals as unknown as BotGoalRepositoryPort,
    goalsOf as unknown as BotGoalResolver,
  );
  const run = () => handler.execute(new ClearBotGoalCommand({ scope, botId: 'bot-1' }));
  return { lookup, goalsOf, run };
}

describe('ClearBotGoalCommandHandler', () => {
  it('reads the bot in the caller’s scope and ends its goal as stopped by its owner', async () => {
    const open = BotGoalEntity.set({
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      objective: 'Triage the bugs',
      limit: 3,
      credentialScopes: null,
      timeZone: null,
    });
    const { lookup, goalsOf, run } = setup(open);
    await run();

    expect(lookup.bot).toHaveBeenCalledWith(scope, 'bot-1');
    expect(goalsOf.end).toHaveBeenCalledWith(
      open,
      { activity: 'cleared', reason: null },
      expect.anything(),
    );
  });

  it('changes nothing for a bot with no goal', async () => {
    const { goalsOf, run } = setup(null);
    await run();
    expect(goalsOf.end).not.toHaveBeenCalled();
  });
});
