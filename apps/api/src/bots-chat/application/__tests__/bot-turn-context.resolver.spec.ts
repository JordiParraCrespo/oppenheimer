import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { Some } from 'oxide.ts';
import type { BotRepositoryPort } from '../../../bots/database/bot.repository.port';
import type { BotDocumentRepositoryPort } from '../../../bots/database/bot-document.repository.port';
import type { BotMemoryFactRepositoryPort } from '../../../bots/database/bot-memory-fact.repository.port';
import type { ModelProviderCredentialRepositoryPort } from '../../../bots/database/model-provider-credential.repository.port';
import type { ProviderKeySealerPort } from '../../../bots/infrastructure/provider-key-sealer.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import type { OwnerHostsPort } from '../../infrastructure/owner-hosts.port';
import type { BotOwnerScopeResolver } from '../bot-owner-scope.resolver';
import type { BotToolboxFactory } from '../bot-toolbox.factory';
import { BotTurnContextResolver } from '../bot-turn-context.resolver';

/**
 * How a turn's moment is read: the owner's hosts in their scope, the home
 * host named among them, a refusal from the hosts module read as "unknown"
 * (the turn still runs), and any other failure failing the turn rather than
 * being hidden. The reads of the bot's own rows are the integration spec's.
 */
const HOME = '11111111-1111-4111-8111-111111111111';

function setup(hostsOf: OwnerHostsPort['hostsOf']) {
  const owner = emptyScope('owner-1', 'org-1');
  const bot = {
    id: 'bot-1',
    name: 'Ops',
    description: '',
    createdByUserId: 'owner-1',
    homeHostId: HOME,
    permission: 'auto',
  };
  const resolver = new BotTurnContextResolver(
    { findForTurn: async () => Some(bot) } as unknown as BotRepositoryPort,
    { findAllForTurn: async () => [] } as unknown as BotDocumentRepositoryPort,
    { findAllForTurn: async () => [] } as unknown as BotMemoryFactRepositoryPort,
    { findHistory: async () => [] } as unknown as BotMessageRepositoryPort,
    {
      findForRun: async () => Some({ sealedKey: Buffer.from('k') }),
    } as unknown as ModelProviderCredentialRepositoryPort,
    { isConfigured: () => true, open: () => 'key' } as unknown as ProviderKeySealerPort,
    { resolve: async () => owner } as unknown as BotOwnerScopeResolver,
    { hostsOf: vi.fn(hostsOf) },
    { tools: () => [], catalog: () => [] } as unknown as BotToolboxFactory,
  );
  const turn = BotTurnEntity.queue({
    organizationId: 'org-1',
    botId: 'bot-1',
    requestedByUserId: 'owner-1',
    provider: 'glm',
    model: 'model-1',
    effort: null,
  });
  return { resolve: () => resolver.resolve(turn, 'Hi', new Date('2026-10-15T09:00:00Z')) };
}

describe('BotTurnContextResolver', () => {
  it('names the home host among the owner’s hosts', async () => {
    const { resolve } = setup(async () => [
      { id: HOME, name: 'build-01', online: true, runningSessions: 1 },
    ]);
    expect((await resolve()).systemPrompt).toContain('Your home host is build-01 (online)');
  });

  it('runs the turn when the hosts module refuses, saying the hosts are unknown', async () => {
    const { resolve } = setup(async () => {
      throw new AppError({
        code: 'HOSTS_004',
        message: 'Hosts are not configured',
        httpStatus: 503,
      });
    });
    expect((await resolve()).systemPrompt).toContain(
      "The person's hosts could not be read just now",
    );
  });

  it('fails the turn on any other failure, rather than hiding it', async () => {
    const { resolve } = setup(async () => {
      throw new TypeError('broken');
    });
    await expect(resolve()).rejects.toThrow('broken');
  });
});
