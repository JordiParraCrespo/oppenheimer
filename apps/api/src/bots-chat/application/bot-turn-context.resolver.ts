import { Inject, Injectable } from '@nestjs/common';
import type { BotEffort, BotTurnRequest } from '@oppenheimer/backend-agents';
import { AppError } from '@oppenheimer/backend-core';
import type { TurnCredentialsPort } from '../../bots/application/turn-credentials.port';
import {
  BOT_DOCUMENT_REPOSITORY,
  BOT_MEMORY_FACT_REPOSITORY,
  BOT_REPOSITORY,
  TURN_CREDENTIALS,
} from '../../bots/bots.di-tokens';
import type { BotRepositoryPort } from '../../bots/database/bot.repository.port';
import type { BotDocumentRepositoryPort } from '../../bots/database/bot-document.repository.port';
import type { BotMemoryFactRepositoryPort } from '../../bots/database/bot-memory-fact.repository.port';
import { BotErrors } from '../../bots/domain/bots.errors';
import { BOT_MESSAGE_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import {
  BOT_HISTORY_MESSAGES,
  botHistory,
  composeBotSystemPrompt,
} from '../domain/bot-prompt.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

const ENGINE_EFFORTS: readonly string[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** What a turn is run with, but the abort signal and the scratch directory its runner owns. */
export type BotTurnContext = Omit<BotTurnRequest, 'signal' | 'scratchDir'>;

/**
 * Everything a turn needs, read when it starts: the bot as it is now (its
 * soul, instructions and memory become the system prompt), the conversation
 * before this turn, this turn's message, and the credential the turn's
 * provider runs on (`TurnCredentialsPort`: a key, or a refreshed sign-in).
 * Every read names the turn's workspace: a bot is the workspace's, and the
 * worker acts for the turn, not for a person, so there is no person's scope
 * to read through.
 */
@Injectable()
export class BotTurnContextResolver {
  constructor(
    @Inject(BOT_REPOSITORY) private readonly bots: BotRepositoryPort,
    @Inject(BOT_DOCUMENT_REPOSITORY) private readonly documents: BotDocumentRepositoryPort,
    @Inject(BOT_MEMORY_FACT_REPOSITORY) private readonly memory: BotMemoryFactRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(TURN_CREDENTIALS) private readonly credentials: TurnCredentialsPort,
  ) {}

  async resolve(turn: BotTurnEntity, message: string, now: Date): Promise<BotTurnContext> {
    const found = await this.bots.findForTurn(turn.organizationId, turn.botId);
    if (found.isNone()) throw new AppError(BotErrors.NOT_FOUND);
    const bot = found.unwrap();
    const credential = await this.credentials.forTurn(turn.organizationId, turn.provider, now);
    const [documents, facts, earlier] = await Promise.all([
      this.documents.findAllForTurn(turn.organizationId, bot.id),
      this.memory.findAllForTurn(turn.organizationId, bot.id),
      this.messages.findHistory(turn.organizationId, bot.id, turn.id, BOT_HISTORY_MESSAGES),
    ]);
    const documentText = (name: string) =>
      documents.find((document) => document.name === name)?.content ?? '';
    return {
      provider: turn.provider,
      ...credential,
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
