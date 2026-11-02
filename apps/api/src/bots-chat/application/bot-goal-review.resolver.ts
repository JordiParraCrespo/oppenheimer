import { Inject, Injectable, Logger } from '@nestjs/common';
import { BOT_MESSAGE_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import type { BotGoalEntity } from '../domain/bot-goal.entity';
import {
  BOT_GOAL_REVIEWER_PROMPT,
  type BotGoalVerdict,
  composeGoalReview,
  goalReviewTranscript,
  goalVerdict,
} from '../domain/bot-goal-review.policy';
import type { HistoryEntry } from '../domain/bot-history.policy';
import { BotCompletionResolver } from './bot-completion.resolver';
import { BotModelAccessResolver } from './bot-model-access.resolver';

/** How long one review may take before the goal goes on without a verdict. */
const REVIEW_TIME_LIMIT_MS = 60_000;

/** The most earlier messages a review reads; the token budget decides what it sends. */
const REVIEW_READ_MAX = 200;

/**
 * The reviewer a goal's ended turn is read by (`25-bots.md` §4.1): the bot's
 * own provider and model as they are now, one completion with no tools
 * (`BotCompletionResolver`). It reads the conversation before the turn
 * and what the turn wrote. It never throws: a bot with no credential, a
 * model that fails or is rate limited, or an answer with no verdict in it is
 * logged and answered as no verdict, and the goal goes on within its limit.
 */
@Injectable()
export class BotGoalReviewResolver {
  private readonly logger = new Logger(BotGoalReviewResolver.name);

  constructor(
    private readonly completions: BotCompletionResolver,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    private readonly access: BotModelAccessResolver,
  ) {}

  async review(goal: BotGoalEntity, turnId: string): Promise<BotGoalVerdict | null> {
    try {
      const target = await this.access.ownModel(goal.organizationId, goal.botId, new Date());
      if (!target) return null;
      const transcript = await this.transcript(goal, turnId);
      const answer = await this.completions.complete(
        {
          ...target,
          // A verdict on a transcript: the model's least effort is enough.
          effort: null,
          systemPrompt: BOT_GOAL_REVIEWER_PROMPT,
          message: composeGoalReview(goal.objective, transcript),
          signal: AbortSignal.timeout(REVIEW_TIME_LIMIT_MS),
        },
        'goal-review',
      );
      const verdict = goalVerdict(answer);
      if (!verdict) this.logger.warn({ message: 'A goal review gave no verdict', goalId: goal.id });
      return verdict;
    } catch (error) {
      this.logger.warn(
        { message: 'A goal review failed; the goal goes on', goalId: goal.id },
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /** What the reviewer reads: the conversation before the turn, then what the turn wrote. */
  private async transcript(goal: BotGoalEntity, turnId: string): Promise<HistoryEntry[]> {
    const [before, texts] = await Promise.all([
      this.messages.findHistory(goal.organizationId, goal.botId, turnId, null, REVIEW_READ_MAX),
      this.messages.findTurnTexts(goal.organizationId, turnId),
    ]);
    return goalReviewTranscript(before, texts);
  }
}
