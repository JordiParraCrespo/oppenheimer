/**
 * The wake of a look a bot asked for with `check_back`: the bot and its owner
 * resolved again, one turn queued keyed by the chain and step with the scopes
 * and zone of the turn that set it, and nothing when the bot or its owner is
 * gone. When each look is due is `bot-check-back.policy.spec.ts`.
 */
import { emptyScope } from '@oppenheimer/backend-authz';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import type { BotModelAccessResolver } from '../../../application/bot-model-access.resolver';
import type { BotOwnerScopeResolver } from '../../../application/bot-owner-scope.resolver';
import { BotTurnMapper } from '../../../bot-turn.mapper';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import type { CheckBack } from '../../../infrastructure/bot-check-backs.port';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { WakeOnCheckBackCommand } from '../wake-on-check-back.command';
import { WakeOnCheckBackCommandHandler } from '../wake-on-check-back.command-handler';

const LOOK: CheckBack = {
  botId: 'bot-1',
  organizationId: 'org-1',
  originTurnId: 'turn-0',
  chainId: 'turn-0',
  step: 2,
  chainStartedAt: new Date('2026-11-23T10:00:00Z'),
  about: 'deploy of api 0.4.2 to dev: check /health answers the new version',
  at: new Date('2026-11-23T10:35:00Z'),
  credentialScopes: ['bots:write', 'sessions:read'],
  timeZone: 'Europe/Madrid',
};

function setup(options: {
  bot?: Partial<BotEntity> | null;
  member?: boolean;
  queued?: 'staged' | 'existing';
}) {
  const bot =
    options.bot === undefined
      ? {
          id: 'bot-1',
          createdByUserId: 'owner-1',
          provider: 'anthropic',
          model: 'claude-sonnet-5-5',
          effort: null,
        }
      : options.bot;
  const turns = {
    enqueueOnce: vi.fn<BotTurnRepositoryPort['enqueueOnce']>(async (turn) => ({
      outcome: options.queued ?? 'staged',
      turnId: turn.id,
    })),
  } satisfies Partial<BotTurnRepositoryPort>;
  const stream = { publish: vi.fn<BotStreamPort['publish']>(async () => undefined) };
  const access = {
    findBot: vi.fn<BotModelAccessResolver['findBot']>(async () => bot as unknown as BotEntity),
  };
  const owners = {
    resolve: vi.fn<BotOwnerScopeResolver['resolve']>(async () =>
      options.member === false ? null : emptyScope('owner-1', 'org-1'),
    ),
  };
  const handler = new WakeOnCheckBackCommandHandler(
    turns as unknown as BotTurnRepositoryPort,
    stream,
    access as unknown as BotModelAccessResolver,
    owners as unknown as BotOwnerScopeResolver,
    new BotTurnMapper(),
  );
  const run = () => handler.execute(new WakeOnCheckBackCommand({ look: LOOK }));
  return { turns, stream, owners, run };
}

describe('WakeOnCheckBackCommandHandler', () => {
  // What breaks this: a bot that said it would check back and never does, or
  // one woken with wider scopes than the turn that asked.
  it('queues one background turn keyed by the chain and step, as narrow as the turn that set it', async () => {
    const { turns, stream, run } = setup({});
    await run();
    expect(turns.enqueueOnce).toHaveBeenCalledTimes(1);
    const [turn, opening] = turns.enqueueOnce.mock.calls[0];
    expect(turn).toMatchObject({
      origin: 'check_back',
      lane: 'background',
      sourceKey: 'check_back:turn-0:2',
      requestedByUserId: 'owner-1',
      credentialScopes: ['bots:write', 'sessions:read'],
      timeZone: 'Europe/Madrid',
    });
    expect(opening.event).toMatchObject({ kind: 'check_back', chainId: 'turn-0', step: 2 });
    expect(opening.content).toContain(LOOK.about);
    expect(stream.publish).toHaveBeenCalledWith('bot-1', {
      type: 'turn',
      turnId: turn.id,
      status: 'queued',
    });
  });

  it('publishes nothing when a job delivered twice finds its turn already queued', async () => {
    const { stream, run } = setup({ queued: 'existing' });
    await run();
    expect(stream.publish).not.toHaveBeenCalled();
  });

  // What breaks this: a bot whose owner left the workspace still woken, as
  // them, for something it set before they left.
  it('wakes nothing when the bot is gone or its owner is no longer a member', async () => {
    const gone = setup({ bot: null });
    await gone.run();
    expect(gone.owners.resolve).not.toHaveBeenCalled();
    expect(gone.turns.enqueueOnce).not.toHaveBeenCalled();

    const left = setup({ member: false });
    await left.run();
    expect(left.turns.enqueueOnce).not.toHaveBeenCalled();
    expect(left.stream.publish).not.toHaveBeenCalled();
  });
});
