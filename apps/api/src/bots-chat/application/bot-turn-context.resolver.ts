import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type BotEffort,
  type BotTurnRequest,
  engineCapabilities,
} from '@oppenheimer/backend-agents';
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
import { BOT_MESSAGE_REPOSITORY, OWNER_HOSTS } from '../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import {
  BOT_HISTORY_MESSAGES,
  botHistory,
  composeBotSystemPrompt,
} from '../domain/bot-prompt.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import type { OwnerHost, OwnerHostsPort } from '../infrastructure/owner-hosts.port';
import { BotOwnerScopeResolver } from './bot-owner-scope.resolver';

const ENGINE_EFFORTS: readonly string[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** What a turn is run with, but the abort signal and the scratch directory its runner owns. */
export type BotTurnContext = Omit<BotTurnRequest, 'signal' | 'scratchDir'>;

/**
 * Model round trips in one chat turn. Below the engine's default: a chat
 * turn answers, and longer work belongs to a session on a host.
 */
export const BOT_TURN_MAX_STEPS = 20;

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
    @Inject(OWNER_HOSTS) private readonly hosts: OwnerHostsPort,
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
        engineCapabilities: engineCapabilities(turn.provider),
        homeHost: hosts?.find((host) => host.id === bot.homeHostId) ?? null,
        hosts,
        tools: [],
      }),
      history: botHistory(earlier),
      message,
      tools: [],
      maxSteps: BOT_TURN_MAX_STEPS,
    };
  }

  /**
   * The owner's hosts, or null when the hosts module refuses to say: the
   * turn still runs, and the prompt says the hosts are unknown rather than
   * that there are none. Anything else the read throws is a fault, and
   * fails the turn like any other.
   */
  private async hostsOf(owner: AccessScope | null, turnId: string): Promise<OwnerHost[] | null> {
    if (!owner) return null;
    try {
      return await this.hosts.hostsOf(owner);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      this.logger.warn({
        message: 'A bot turn could not read its hosts',
        turnId,
        code: error.code,
      });
      return null;
    }
  }
}
