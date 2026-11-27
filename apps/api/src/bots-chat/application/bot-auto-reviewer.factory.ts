import { Injectable } from '@nestjs/common';
import type { BotTurnRequest } from '@oppenheimer/backend-agents';
import {
  autoVerdict,
  BOT_AUTO_REVIEWER_PROMPT,
  type BotAutoReviewContext,
  type BotAutoVerdict,
  composeAutoReview,
} from '../domain/bot-auto-review.policy';
import { reviewEffort } from '../domain/bot-review-effort.policy';
import type { BotReviewedCall } from '../domain/bot-rule-review.policy';
import { type BotCompletionFor, BotCompletionResolver } from './bot-completion.resolver';

/** What a review runs on: the turn's provider, model and key. */
type BotReviewEngine = Pick<
  BotTurnRequest,
  'provider' | 'apiKey' | 'accountId' | 'baseUrl' | 'model' | 'effort'
>;

/** How long one review may take before the call asks instead. */
const AUTO_REVIEW_TIME_LIMIT_MS = 30_000;

/** Decides, under Auto, whether a call runs without the owner; throws when it cannot say, and the call then asks. */
export interface BotAutoReviewer {
  /** `signal` is the turn's: a turn stopped mid-review stops the review with it. */
  review(call: BotReviewedCall, signal?: AbortSignal): Promise<BotAutoVerdict>;
}

/**
 * The reviewer a turn's asking calls are read by under Auto: the
 * turn's own provider, model and key, one completion per call with no tools
 * (`BotCompletionResolver`), shown the owner's own words and the call, never
 * the bot's text or what its tools returned.
 */
@Injectable()
export class BotAutoReviewerFactory {
  constructor(private readonly completions: BotCompletionResolver) {}

  /** A reviewer for one turn, on its model, whose calls' spend is the bot's. */
  create(
    model: BotReviewEngine,
    bot: Omit<BotCompletionFor, 'purpose'>,
    trusted: BotAutoReviewContext,
  ): BotAutoReviewer {
    return {
      review: async (call, signal) => {
        const answer = await this.completions.complete(
          {
            ...model,
            effort: reviewEffort(model),
            systemPrompt: BOT_AUTO_REVIEWER_PROMPT,
            message: composeAutoReview(call, trusted),
            signal: signal
              ? AbortSignal.any([signal, AbortSignal.timeout(AUTO_REVIEW_TIME_LIMIT_MS)])
              : AbortSignal.timeout(AUTO_REVIEW_TIME_LIMIT_MS),
          },
          { ...bot, purpose: 'auto_review' },
        );
        return autoVerdict(answer);
      },
    };
  }
}
