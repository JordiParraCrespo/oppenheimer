import { Inject, Injectable } from '@nestjs/common';
import type { BotEffort, BotTurnRequest } from '@oppenheimer/backend-agents';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import {
  BOT_DOCUMENT_REPOSITORY,
  BOT_MEMORY_FACT_REPOSITORY,
  BOT_MESSAGE_REPOSITORY,
  BOT_REPOSITORY,
  MODEL_PROVIDER_CREDENTIAL_REPOSITORY,
  PROVIDER_KEY_SEALER,
} from '../bots.di-tokens';
import type { BotRepositoryPort } from '../database/bot.repository.port';
import type { BotDocumentRepositoryPort } from '../database/bot-document.repository.port';
import type { BotMemoryFactRepositoryPort } from '../database/bot-memory-fact.repository.port';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import type { ModelProviderCredentialRepositoryPort } from '../database/model-provider-credential.repository.port';
import {
  BOT_HISTORY_MESSAGES,
  botHistory,
  composeBotSystemPrompt,
} from '../domain/bot-prompt.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { BotErrors } from '../domain/bots.errors';
import type { ProviderKeySealerPort } from '../infrastructure/provider-key-sealer.port';

const ENGINE_EFFORTS: readonly string[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** What a turn is run with, but the abort signal and the scratch directory its runner owns. */
export type BotTurnContext = Omit<BotTurnRequest, 'signal' | 'scratchDir'>;

/**
 * Everything a turn needs, read when it starts: the bot as it is now (its
 * soul, instructions and memory become the system prompt), the conversation
 * before this turn, this turn's message, and the workspace's key for the
 * turn's provider, opened. Read as the workspace: a bot is the workspace's,
 * and the worker acts for the turn, not for a person's request.
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
  ) {}

  async resolve(turn: BotTurnEntity, message: string, now: Date): Promise<BotTurnContext> {
    const scope = workspaceScope(turn);
    const found = await this.bots.findOneById(scope, turn.botId);
    if (found.isNone()) throw new AppError(BotErrors.NOT_FOUND);
    const bot = found.unwrap();
    const stored = await this.credentials.findForRun(turn.organizationId, turn.provider);
    if (stored.isNone() || !this.sealer.isConfigured()) {
      throw new AppError(BotErrors.PROVIDER_KEY_MISSING);
    }
    const credential = stored.unwrap();
    const [documents, facts, earlier] = await Promise.all([
      this.documents.findAll(scope, bot.id),
      this.memory.findAll(scope, bot.id),
      this.messages.findHistory(turn.organizationId, bot.id, turn.id, BOT_HISTORY_MESSAGES),
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
      }),
      history: botHistory(earlier),
      message,
      tools: [],
    };
  }
}

/** The tenant clause alone: a bot and its parts are the workspace's, readable by its own work. */
function workspaceScope(turn: BotTurnEntity): AccessScope {
  return {
    userId: turn.requestedByUserId ?? '',
    organizationId: turn.organizationId,
    teamIds: [],
    grants: new Map(),
    bypass: false,
  };
}
