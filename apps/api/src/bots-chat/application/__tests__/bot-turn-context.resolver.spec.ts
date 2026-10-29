import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import type { TurnCredentialsPort } from '../../../bots/application/turn-credentials.port';
import type { BotRepositoryPort } from '../../../bots/database/bot.repository.port';
import type { BotDocumentRepositoryPort } from '../../../bots/database/bot-document.repository.port';
import type { BotMemoryFactRepositoryPort } from '../../../bots/database/bot-memory-fact.repository.port';
import type { BotConversationSummaryRepositoryPort } from '../../database/bot-conversation-summary.repository.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { BotConversationSummaryEntity } from '../../domain/bot-conversation-summary.entity';
import { BotMessageEntity } from '../../domain/bot-message.entity';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { type BotTurnContext, BotTurnEntity } from '../../domain/bot-turn.entity';
import type { OwnerHostsPort } from '../../infrastructure/owner-hosts.port';
import type { BotApprovalRequestFactory } from '../bot-approval-request.factory';
import { BotModelAccessResolver } from '../bot-model-access.resolver';
import type { BotOwnerPermissionsResolver } from '../bot-owner-permissions.resolver';
import type { BotOwnerScopeResolver } from '../bot-owner-scope.resolver';
import type { BotPermissionsResolver } from '../bot-permissions.resolver';
import type { BotRuleReviewerFactory } from '../bot-rule-reviewer.factory';
import type { BotSubagentRunnerFactory } from '../bot-subagent-runner.factory';
import type { BotToolboxFactory } from '../bot-toolbox.factory';
import { BotTurnContextResolver } from '../bot-turn-context.resolver';
import type { BotTurnOpeningResolver } from '../bot-turn-opening.resolver';

/**
 * How a turn's moment is read and where it goes: the owner's hosts in their
 * scope, the home host named among them, a refusal from the hosts module
 * read as "unknown" (the turn still runs), and any other failure failing the
 * turn rather than being hidden; all of it in the block that opens this
 * turn's message, so the system prompt is the same bytes on every turn of an
 * unchanged bot and the provider's prompt cache hits. The reads of the bot's
 * own rows are the integration spec's.
 */
const HOME = '11111111-1111-4111-8111-111111111111';

function setup(
  hostsOf: OwnerHostsPort['hostsOf'],
  conversation: {
    summary?: BotConversationSummaryEntity;
    findHistory?: BotMessageRepositoryPort['findHistory'];
    lastContext?: BotTurnContext;
  } = {},
) {
  const owner = emptyScope('owner-1', 'org-1');
  const bot = {
    id: 'bot-1',
    name: 'Ops',
    description: '',
    createdByUserId: 'owner-1',
    homeHostId: HOME,
    permission: 'auto',
  };
  const access = new BotModelAccessResolver(
    { findForTurn: async () => Some(bot) } as unknown as BotRepositoryPort,
    {
      forTurn: async () => ({ apiKey: 'key' }),
      has: async () => true,
    } satisfies TurnCredentialsPort,
  );
  const resolver = new BotTurnContextResolver(
    access,
    { findAllForTurn: async () => [] } as unknown as BotDocumentRepositoryPort,
    { findAllForTurn: async () => [] } as unknown as BotMemoryFactRepositoryPort,
    {
      findHistory: conversation.findHistory ?? (async () => []),
    } as unknown as BotMessageRepositoryPort,
    {
      findForBot: async () => (conversation.summary ? Some(conversation.summary) : None),
    } as unknown as BotConversationSummaryRepositoryPort,
    { resolve: async () => owner } as unknown as BotOwnerScopeResolver,
    { hostsOf: vi.fn(hostsOf) },
    {
      findLastContext: async () => conversation.lastContext ?? null,
    } satisfies Pick<BotTurnRepositoryPort, 'findLastContext'> as unknown as BotTurnRepositoryPort,
    { tools: () => [], readOnlyTools: () => [], catalog: () => [] } as unknown as BotToolboxFactory,
    {} as BotApprovalRequestFactory,
    { heldScopes: async () => new Set() } as unknown as BotOwnerPermissionsResolver,
    { resolve: async () => ({ prompt: 'Hi', images: [] }) } as unknown as BotTurnOpeningResolver,
    { create: () => ({ run: async () => [] }) } as unknown as BotSubagentRunnerFactory,
    { forBot: async () => NO_PERMISSIONS } as unknown as BotPermissionsResolver,
    {
      create: () => ({ review: async () => ({ effect: 'none' }) }),
    } as unknown as BotRuleReviewerFactory,
  );
  const turnFrom = (timeZone: string | null) =>
    BotTurnEntity.queue({
      organizationId: 'org-1',
      botId: 'bot-1',
      requestedByUserId: 'owner-1',
      provider: 'glm',
      model: 'model-1',
      effort: null,
      timeZone,
    });
  return {
    resolve: (at = new Date('2026-10-15T09:00:00Z'), timeZone: string | null = null) =>
      resolver.resolve(turnFrom(timeZone), at),
  };
}

describe('BotTurnContextResolver', () => {
  it('names the home host among the owner’s hosts', async () => {
    const { resolve } = setup(async () => [
      { id: HOME, name: 'build-01', online: true, runningSessions: 1 },
    ]);
    expect((await resolve()).message).toContain('Your home host is build-01 (online)');
  });

  it('opens the message with the turn context and ends it with what the person wrote', async () => {
    const { resolve } = setup(async () => []);
    const { message } = await resolve(new Date('2026-10-15T09:00:00Z'), 'Europe/Madrid');
    expect(message).toMatch(
      /^<turn_context>\nIt is Thursday, 15 October 2026, 11:00 \(Europe\/Madrid/,
    );
    expect(message.endsWith('</turn_context>\n\nHi')).toBe(true);
  });

  it('tells the turn how full its context was when the last turn ended, in the message, not the prompt', async () => {
    const { resolve } = setup(async () => [], {
      lastContext: { tokens: 120_000, window: 200_000 },
    });
    const { message, systemPrompt } = await resolve(new Date('2026-10-15T09:00:00Z'), null);
    expect(message).toContain('Your context was 60% full at the end of your last turn');
    expect(systemPrompt).not.toContain('Your context was');
  });

  it('composes the same system prompt on two turns apart in time, zone and hosts', async () => {
    const hosts = vi
      .fn<OwnerHostsPort['hostsOf']>()
      .mockResolvedValueOnce([{ id: HOME, name: 'build-01', online: true, runningSessions: 1 }])
      .mockResolvedValueOnce([
        { id: HOME, name: 'build-01', online: false, runningSessions: 0 },
        { id: 'other', name: 'old-laptop', online: true, runningSessions: 2 },
      ]);
    const { resolve } = setup(hosts);
    const first = await resolve(new Date('2026-10-15T09:00:00Z'), 'Europe/Madrid');
    const second = await resolve(new Date('2026-10-16T21:37:00Z'), 'America/New_York');
    expect(second.systemPrompt).toBe(first.systemPrompt);
    expect(second.message).not.toBe(first.message);
    expect(second.message).toContain('old-laptop');
  });

  it('runs the turn when the hosts module refuses, saying the hosts are unknown', async () => {
    const { resolve } = setup(async () => {
      throw new AppError({
        code: 'HOSTS_004',
        message: 'Hosts are not configured',
        httpStatus: 503,
      });
    });
    expect((await resolve()).message).toContain("The person's hosts could not be read just now");
  });

  it('fails the turn on any other failure, rather than hiding it', async () => {
    const { resolve } = setup(async () => {
      throw new TypeError('broken');
    });
    await expect(resolve()).rejects.toThrow('broken');
  });
  it('sends the summary first, then the messages after its cutoff, read from there', async () => {
    const summary = BotConversationSummaryEntity.first({
      organizationId: 'org-1',
      botId: 'bot-1',
      content: 'The person deploys from build-01.',
      through: { id: 'm-cut', createdAt: new Date('2026-10-14T09:00:00Z') },
    });
    const findHistory = vi.fn<BotMessageRepositoryPort['findHistory']>(async () => [
      BotMessageEntity.createNew({
        organizationId: 'org-1',
        botId: 'bot-1',
        turnId: 'turn-0',
        role: 'user',
        content: 'Deploy again?',
        steps: [],
        position: 0,
      }),
    ]);
    const { resolve } = setup(async () => [], { summary, findHistory });
    const { history } = await resolve();
    expect(findHistory).toHaveBeenCalledWith(
      'org-1',
      'bot-1',
      expect.any(String),
      'm-cut',
      expect.any(Number),
    );
    expect(history).toHaveLength(2);
    expect(history[0].text).toContain('The person deploys from build-01.');
    expect(history[1]).toEqual({ role: 'user', text: 'Deploy again?' });
  });
});
