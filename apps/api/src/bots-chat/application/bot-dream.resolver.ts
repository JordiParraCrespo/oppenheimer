import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { BOT_MEMORY_FACT_REPOSITORY } from '../../bots/bots.di-tokens';
import type { BotMemoryFactRepositoryPort } from '../../bots/database/bot-memory-fact.repository.port';
import { BotMemoryDreamMapper } from '../bot-memory-dream.mapper';
import {
  BOT_CONVERSATION_SUMMARY_REPOSITORY,
  BOT_MESSAGE_REPOSITORY,
} from '../bots-chat.di-tokens';
import type { BotConversationSummaryRepositoryPort } from '../database/bot-conversation-summary.repository.port';
import type { DreamWrite } from '../database/bot-memory-dream.repository.port';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import {
  BOT_DREAM_READ_MAX,
  BOT_DREAMER_PROMPT,
  composeDreamRequest,
  factRefs,
  readDream,
  rewritableFacts,
} from '../domain/bot-dream.policy';
import { BOT_COMPLETION_TIME_LIMIT_MS } from '../domain/bot-turn.entity';
import { BotCompletionResolver } from './bot-completion.resolver';
import { BotModelAccessResolver } from './bot-model-access.resolver';

/**
 * What a dream would write (`25-bots.md` §4.1, "Dreaming"): the bot (the
 * trigger already decided it should dream, and claimed the day for it); its
 * facts, the ones it wrote itself to rewrite and the rest to
 * leave; its conversation summary and newest messages, the ground truth the
 * notes are checked against; and one tool-less call of its own model, read by
 * `readDream`. Null when there is nothing to do, or when the answer is one
 * nothing of should be used. A model that fails throws, and the queue retries.
 */
@Injectable()
export class BotDreamResolver {
  private readonly logger = new Logger(BotDreamResolver.name);

  constructor(
    private readonly access: BotModelAccessResolver,
    private readonly completions: BotCompletionResolver,
    private readonly mapper: BotMemoryDreamMapper,
    @Inject(BOT_MEMORY_FACT_REPOSITORY) private readonly memory: BotMemoryFactRepositoryPort,
    @Inject(BOT_CONVERSATION_SUMMARY_REPOSITORY)
    private readonly summaries: BotConversationSummaryRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
  ) {}

  async dream(organizationId: string, botId: string, force: boolean): Promise<DreamWrite | null> {
    const now = new Date();
    const bot = await this.access.findBot(organizationId, botId);
    if (!bot) return null;
    // The trigger claimed the day's slot when it staged this job, so a retry
    // of it runs; only a bot that stopped learning since is let be.
    if (!force && !bot.learnAutomatically) return null;
    const target = await this.access.ownModel(organizationId, botId, now);
    if (!target) return null;
    const [stored, summary, messages] = await Promise.all([
      this.memory.findAllForTurn(organizationId, botId),
      this.summaries.findForBot(organizationId, botId),
      this.messages.findRecent(organizationId, botId, BOT_DREAM_READ_MAX),
    ]);
    const facts = stored.map((fact) => this.mapper.toDreamFact(fact)).reverse();
    const rewrite = rewritableFacts(facts, botId);
    if (rewrite.length === 0) return null;
    const rewriting = new Set(rewrite.map((fact) => fact.id));
    const keep = facts.filter((fact) => !rewriting.has(fact.id));
    const refs = factRefs(rewrite);
    const answer = await this.completions.complete(
      {
        ...target,
        systemPrompt: BOT_DREAMER_PROMPT,
        message: composeDreamRequest({
          rewrite: refs,
          keep,
          summary: summary.isSome() ? summary.unwrap().content : null,
          messages,
        }),
        signal: AbortSignal.timeout(BOT_COMPLETION_TIME_LIMIT_MS),
      },
      { organizationId, botId, purpose: 'dream' },
    );
    const ownLeft = keep.filter((fact) => fact.botId === botId).length;
    const plan = readDream(answer, refs, ownLeft, new Date());
    if (!plan) {
      this.logger.warn({ message: "A bot's dream answered nothing usable", botId });
      return null;
    }
    return {
      id: randomUUID(),
      organizationId,
      botId,
      read: rewrite.map((fact) => ({ id: fact.id, updatedAt: fact.updatedAt })),
      facts: plan.facts,
      note: plan.note,
    };
  }
}
