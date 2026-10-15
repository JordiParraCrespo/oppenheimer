import { Inject, Injectable, Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { BotEffort, BotTurnRequest } from '@oppenheimer/backend-agents';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import {
  BOT_DOCUMENT_REPOSITORY,
  BOT_MEMORY_FACT_REPOSITORY,
  BOT_REPOSITORY,
  MODEL_PROVIDER_CREDENTIAL_REPOSITORY,
  PROVIDER_KEY_SEALER,
} from '../../bots/bots.di-tokens';
import type { BotRepositoryPort } from '../../bots/database/bot.repository.port';
import type { BotDocumentRepositoryPort } from '../../bots/database/bot-document.repository.port';
import type { BotMemoryFactRepositoryPort } from '../../bots/database/bot-memory-fact.repository.port';
import type { ModelProviderCredentialRepositoryPort } from '../../bots/database/model-provider-credential.repository.port';
import { BotErrors } from '../../bots/domain/bots.errors';
import type { ProviderKeySealerPort } from '../../bots/infrastructure/provider-key-sealer.port';
import { FindHostsQuery } from '../../hosts/queries/find-hosts/find-hosts.query';
import { BOT_MESSAGE_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import {
  BOT_HISTORY_MESSAGES,
  type BotPromptHost,
  botHistory,
  composeBotSystemPrompt,
} from '../domain/bot-prompt.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { BotOwnerScopeResolver } from './bot-owner-scope.resolver';
import { BotToolboxFactory } from './bot-toolbox.factory';

const ENGINE_EFFORTS: readonly string[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** What a turn is run with, but the abort signal and the scratch directory its runner owns. */
export type BotTurnContext = Omit<BotTurnRequest, 'signal' | 'scratchDir'>;

/**
 * Model round trips in one chat turn. Below the engine's default: a chat
 * turn answers, and longer work belongs to a session on a host.
 */
export const BOT_TURN_MAX_STEPS = 20;

/** A host as the hosts module answers `FindHostsQuery`, the part a turn reads. */
interface HostOverviewView {
  host: { id: string; name: string };
  online: boolean;
  runningSessions: number;
}

/**
 * Everything a turn needs, read when it starts: the bot as it is now (its
 * soul, instructions and memory become the system prompt), the conversation
 * before this turn, this turn's message, the workspace's key for the turn's
 * provider, opened, and the moment it runs in: the sender's time, the bot's
 * home host and the owner's hosts, read in the owner's scope. The bot's own
 * rows are read by the turn's workspace; what the owner can reach is read
 * as the owner, so the bot sees no more than they do.
 */
@Injectable()
export class BotTurnContextResolver {
  constructor(
    @Inject(BOT_REPOSITORY) private readonly bots: BotRepositoryPort,
    @Inject(BOT_DOCUMENT_REPOSITORY) private readonly documents: BotDocumentRepositoryPort,
    @Inject(BOT_MEMORY_FACT_REPOSITORY) private readonly memory: BotMemoryFactRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
    @Inject(PROVIDER_KEY_SEALER) private readonly sealer: ProviderKeySealerPort,
    private readonly owners: BotOwnerScopeResolver,
    private readonly queryBus: QueryBus,
    private readonly toolbox: BotToolboxFactory,
  ) {}

  private readonly logger = new Logger(BotTurnContextResolver.name);

  async resolve(turn: BotTurnEntity, message: string, now: Date): Promise<BotTurnContext> {
    const found = await this.bots.findForTurn(turn.organizationId, turn.botId);
    if (found.isNone()) throw new AppError(BotErrors.NOT_FOUND);
    const bot = found.unwrap();
    const stored = await this.credentials.findForRun(turn.organizationId, turn.provider);
    if (stored.isNone() || !this.sealer.isConfigured()) {
      throw new AppError(BotErrors.PROVIDER_KEY_MISSING);
    }
    const credential = stored.unwrap();
    const owner = await this.owners.resolve(turn.organizationId, bot.createdByUserId);
    const [documents, facts, earlier, hosts] = await Promise.all([
      this.documents.findAllForTurn(turn.organizationId, bot.id),
      this.memory.findAllForTurn(turn.organizationId, bot.id),
      this.messages.findHistory(turn.organizationId, bot.id, turn.id, BOT_HISTORY_MESSAGES),
      this.hostsOf(owner, turn.id),
    ]);
    // An owner who can no longer act leaves the bot nothing to act through.
    const tools = owner
      ? this.toolbox.tools({
          owner,
          organizationId: turn.organizationId,
          botId: bot.id,
          turnId: turn.id,
          homeHostId: bot.homeHostId,
          timeZone: turn.timeZone ?? 'UTC',
          permission: bot.permission,
        })
      : [];
    const documentText = (name: string) =>
      documents.find((document) => document.name === name)?.content ?? '';
    return {
      provider: turn.provider,
      apiKey: this.sealer.open(credential.sealedKey),
      model: turn.model,
      effort: ENGINE_EFFORTS.includes(turn.effort ?? '') ? (turn.effort as BotEffort) : null,
      systemPrompt: composeBotSystemPrompt({
        name: bot.name,
        description: bot.description,
        soul: documentText('soul'),
        instructions: documentText('instructions'),
        facts: [...facts].reverse().map((fact) => fact.content),
        now,
        timeZone: turn.timeZone,
        homeHost: hosts?.find((host) => host.id === bot.homeHostId) ?? null,
        hosts,
        tools: owner ? this.toolbox.catalog() : [],
      }),
      history: botHistory(earlier),
      message,
      tools,
      maxSteps: BOT_TURN_MAX_STEPS,
    };
  }

  /**
   * The owner's hosts, or null when they cannot be read: the turn still
   * runs, and the prompt says the hosts are unknown rather than that there
   * are none.
   */
  private async hostsOf(
    owner: AccessScope | null,
    turnId: string,
  ): Promise<(BotPromptHost & { id: string })[] | null> {
    if (!owner) return null;
    try {
      const overviews = await this.queryBus.execute<FindHostsQuery, HostOverviewView[]>(
        new FindHostsQuery({ scope: owner }),
      );
      return overviews.map(({ host, online, runningSessions }) => ({
        id: host.id,
        name: host.name,
        online,
        runningSessions,
      }));
    } catch (error) {
      const stack = error instanceof Error ? error.stack : String(error);
      this.logger.warn({ message: 'A bot turn could not read its hosts', turnId }, stack);
      return null;
    }
  }
}
