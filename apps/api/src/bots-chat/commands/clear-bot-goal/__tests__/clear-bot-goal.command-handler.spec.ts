/**
 * The owner stops a bot's goal (`25-bots.md` §4.1). What breaks this: a
 * continuation already queued running after the owner said stop; a stop
 * leaving no trace in the chat; a bot in another workspace reached.
 */
import { emptyScope } from '@oppenheimer/backend-authz';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import type { BotGoalRepositoryPort } from '../../../database/bot-goal.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotGoalEntity } from '../../../domain/bot-goal.entity';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { ClearBotGoalCommand } from '../clear-bot-goal.command';
import { ClearBotGoalCommandHandler } from '../clear-bot-goal.command-handler';

const scope = emptyScope('owner-1', 'org-1');

function setup(stored: BotGoalEntity | null) {
  const waiting = BotTurnEntity.queue({
    organizationId: 'org-1',
    botId: 'bot-1',
    requestedByUserId: 'owner-1',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: null,
    origin: 'goal',
    sourceKey: 'goal:goal-1:2',
  });
  const lookup = {
    bot: vi.fn<BotLookupPort['bot']>(
      async () => ({ id: 'bot-1', organizationId: 'org-1' }) as unknown as BotEntity,
    ),
  };
  const goals = {
    findForBot: vi.fn<BotGoalRepositoryPort['findForBot']>(async () => stored),
    end: vi.fn<BotGoalRepositoryPort['end']>(async () => true),
  } satisfies Partial<BotGoalRepositoryPort>;
  const turns = {
    findQueuedBySourcePrefix: vi.fn<BotTurnRepositoryPort['findQueuedBySourcePrefix']>(async () => [
      waiting,
    ]),
    finish: vi.fn<BotTurnRepositoryPort['finish']>(async () => true),
  } satisfies Partial<BotTurnRepositoryPort>;
  const stream = { publish: vi.fn<BotStreamPort['publish']>(async () => undefined) };
  const handler = new ClearBotGoalCommandHandler(
    lookup as unknown as BotLookupPort,
    goals as unknown as BotGoalRepositoryPort,
    turns as unknown as BotTurnRepositoryPort,
    stream,
  );
  const run = () => handler.execute(new ClearBotGoalCommand({ scope, botId: 'bot-1' }));
  return { lookup, goals, turns, stream, waiting, run };
}

describe('ClearBotGoalCommandHandler', () => {
  it('ends the goal with a line saying the owner stopped it, and cancels the continuation waiting', async () => {
    const open = BotGoalEntity.set({
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      objective: 'Triage the bugs',
      limit: 3,
      credentialScopes: null,
      timeZone: null,
    });
    const { lookup, goals, turns, waiting, run } = setup(open);
    await run();

    expect(lookup.bot).toHaveBeenCalledWith(scope, 'bot-1');
    expect(goals.end.mock.calls[0][1]?.event).toMatchObject({ kind: 'goal', activity: 'cleared' });
    expect(turns.findQueuedBySourcePrefix).toHaveBeenCalledWith(
      'org-1',
      'bot-1',
      `goal:${open.id}:`,
    );
    expect(waiting.status).toBe('cancelled');
    expect(turns.finish).toHaveBeenCalledWith(waiting, expect.anything());
  });

  it('changes nothing for a bot with no goal', async () => {
    const { goals, turns, run } = setup(null);
    await run();

    expect(goals.end).not.toHaveBeenCalled();
    expect(turns.finish).not.toHaveBeenCalled();
  });
});
