import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BotEngine } from '@oppenheimer/backend-agents';
import { BOT_ENGINE, BOT_MESSAGE_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import type { BotGoalEntity } from '../domain/bot-goal.entity';
import {
  BOT_GOAL_REVIEWER_PROMPT,
  type BotGoalVerdict,
  composeGoalReview,
  goalVerdict,
} from '../domain/bot-goal-review.policy';
import { type HistoryEntry, historyEntry } from '../domain/bot-history.policy';
import { BotModelAccessResolver } from './bot-model-access.resolver';

/** How long one review may take before the goal goes on without a verdict. */
const REVIEW_TIME_LIMIT_MS = 60_000;

/** The most earlier messages a review reads; the token budget decides what it sends. */
const REVIEW_READ_MAX = 200;

/**
 * The reviewer a goal's ended turn is read by (`25-bots.md` §4.1): the bot's
 * own provider and model as they are now, one completion with no tools, in a
 * scratch directory of its own. It reads the conversation before the turn
 * and what the turn wrote. It never throws: a bot with no credential, a
 * model that fails or is rate limited, or an answer with no verdict in it is
 * logged and answered as no verdict, and the goal goes on within its limit.
 */
@Injectable()
export class BotGoalReviewResolver {
  private readonly logger = new Logger(BotGoalReviewResolver.name);

  constructor(
    @Inject(BOT_ENGINE) private readonly engine: BotEngine,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    private readonly access: BotModelAccessResolver,
  ) {}

  async review(goal: BotGoalEntity, turnId: string): Promise<BotGoalVerdict | null> {
    let scratchDir: string | null = null;
    try {
      const target = await this.access.ownModel(goal.organizationId, goal.botId, new Date());
      if (!target) return null;
      const transcript = await this.transcript(goal, turnId);
      scratchDir = await mkdtemp(join(tmpdir(), 'bot-goal-review-'));
      const answer = await this.engine.complete({
        ...target,
        // A verdict on a transcript: the model's least effort is enough.
        effort: null,
        systemPrompt: BOT_GOAL_REVIEWER_PROMPT,
        message: composeGoalReview(goal.objective, transcript),
        signal: AbortSignal.timeout(REVIEW_TIME_LIMIT_MS),
        scratchDir,
      });
      const verdict = goalVerdict(answer);
      if (!verdict) this.logger.warn({ message: 'A goal review gave no verdict', goalId: goal.id });
      return verdict;
    } catch (error) {
      this.logger.warn(
        { message: 'A goal review failed; the goal goes on', goalId: goal.id },
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    } finally {
      if (scratchDir) await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** The conversation before the turn, as a turn reads it back, then what the turn wrote. */
  private async transcript(goal: BotGoalEntity, turnId: string): Promise<HistoryEntry[]> {
    const [before, texts] = await Promise.all([
      this.messages.findHistory(goal.organizationId, goal.botId, turnId, null, REVIEW_READ_MAX),
      this.messages.findTurnTexts(goal.organizationId, turnId),
    ]);
    return [
      ...before.filter((message) => message.role !== 'activity').map(historyEntry),
      ...texts.map((text) => ({ role: 'assistant' as const, text })),
    ];
  }
}
