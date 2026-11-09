/**
 * The owner resumes a bot's paused goal (`25-bots.md` §4.1). What breaks
 * this: a resume that queues nothing, or queues a turn for a goal that is
 * running; a bot in another workspace reached; an old goal paused on its
 * last continuation that can never be resumed nor cleared by Resume. Queuing
 * the turn and its line is `BotGoalResolver`'s, specced there.
 */
import { emptyScope } from '@oppenheimer/backend-authz';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import type { BotGoalResolver } from '../../../application/bot-goal.resolver';
import type { BotGoalRepositoryPort } from '../../../database/bot-goal.repository.port';
import { BotGoalEntity, type BotGoalProps } from '../../../domain/bot-goal.entity';
import { ResumeBotGoalCommand } from '../resume-bot-goal.command';
import { ResumeBotGoalCommandHandler } from '../resume-bot-goal.command-handler';

const scope = emptyScope('owner-1', 'org-1');
const PROPS = {
  organizationId: 'org-1',
  botId: 'bot-1',
  requestedByUserId: 'owner-1',
  provider: 'glm' as const,
  model: 'glm-5.3',
  effort: null,
};

function goal(props: Partial<BotGoalProps> = {}): BotGoalEntity {
  return BotGoalEntity.create({
    id: 'goal-1',
    props: {
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      objective: 'Triage the bugs',
      limit: null,
      continuations: 4,
      tokensUsed: 0,
      tokenBudget: null,
      idleTurns: 3,
      claim: null,
      paused: { reason: 'no_progress', note: null, at: new Date() },
      credentialScopes: null,
      timeZone: null,
      ...props,
    },
  });
}

function setup(stored: BotGoalEntity | null, owned = true) {
  const lookup = {
    bot: vi.fn<BotLookupPort['bot']>(
      async () => ({ id: 'bot-1', organizationId: 'org-1' }) as unknown as BotEntity,
    ),
  };
  const goals = {
    findForBot: vi.fn<BotGoalRepositoryPort['findForBot']>(async () => stored),
  } satisfies Partial<BotGoalRepositoryPort>;
  const goalsOf = {
    end: vi.fn<BotGoalResolver['end']>(async () => true),
    continuationProps: vi.fn<BotGoalResolver['continuationProps']>(async () =>
      owned ? PROPS : null,
    ),
    queueContinuation: vi.fn<BotGoalResolver['queueContinuation']>(async () => true),
  };
  const handler = new ResumeBotGoalCommandHandler(
    lookup as unknown as BotLookupPort,
    goals as unknown as BotGoalRepositoryPort,
    goalsOf as unknown as BotGoalResolver,
  );
  const run = () => handler.execute(new ResumeBotGoalCommand({ scope, botId: 'bot-1' }));
  return { lookup, goalsOf, run };
}

describe('ResumeBotGoalCommandHandler', () => {
  it('reads the bot in the caller’s scope and queues the paused goal’s next turn with its line', async () => {
    const paused = goal();
    const { lookup, goalsOf, run } = setup(paused);
    await run();

    expect(lookup.bot).toHaveBeenCalledWith(scope, 'bot-1');
    expect(paused.paused).toBeNull();
    expect(paused.idleTurns).toBe(0);
    expect(goalsOf.queueContinuation).toHaveBeenCalledWith(
      paused,
      PROPS,
      null,
      false,
      expect.anything(),
      true,
    );
  });

  it('changes nothing for a goal that runs, or a bot with none', async () => {
    for (const stored of [goal({ paused: null }), null]) {
      const { goalsOf, run } = setup(stored);
      await run();
      expect(goalsOf.queueContinuation).not.toHaveBeenCalled();
      expect(goalsOf.end).not.toHaveBeenCalled();
    }
  });

  it('ends an old goal paused on its last continuation, which has none left to queue', async () => {
    const spent = goal({ limit: 20, continuations: 20 });
    const { goalsOf, run } = setup(spent);
    await run();
    expect(goalsOf.queueContinuation).not.toHaveBeenCalled();
    expect(goalsOf.end).toHaveBeenCalledWith(
      spent,
      { activity: 'exhausted', reason: null },
      expect.anything(),
    );
  });

  it('stops the goal when its owner can no longer act in the workspace', async () => {
    const paused = goal();
    const { goalsOf, run } = setup(paused, false);
    await run();
    expect(goalsOf.queueContinuation).not.toHaveBeenCalled();
    expect(goalsOf.end).toHaveBeenCalledWith(
      paused,
      { activity: 'stopped', reason: 'access_lost' },
      expect.anything(),
    );
  });
});
