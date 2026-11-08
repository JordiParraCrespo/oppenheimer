import { Injectable } from '@nestjs/common';
import type { BotTurnRequest } from '@oppenheimer/backend-agents';
import { reviewEffort } from '../domain/bot-goal-review.policy';
import {
  BOT_RULE_REVIEWER_PROMPT,
  type BotReviewedCall,
  type BotRuleVerdict,
  composeRuleReview,
  ruleVerdict,
} from '../domain/bot-rule-review.policy';
import type { BotPermissions } from '../domain/bot-tool-permission.policy';
import { type BotCompletionFor, BotCompletionResolver } from './bot-completion.resolver';

/** What a review runs on: the turn's provider, model and key. */
type BotReviewEngine = Pick<
  BotTurnRequest,
  'provider' | 'apiKey' | 'accountId' | 'baseUrl' | 'model' | 'effort'
>;

/** How long one review may take before the call asks instead. */
const REVIEW_TIME_LIMIT_MS = 30_000;

/** Reads a call against the owner's rules; throws when it cannot say, and the call then asks. */
export interface BotRuleReviewer {
  review(call: BotReviewedCall, rules: BotPermissions['rules']): Promise<BotRuleVerdict>;
}

/**
 * The reviewer a turn's asking calls are read by (`25-bots.md` §5): the
 * turn's own provider, model and key, one completion per call with no tools
 * (`BotCompletionResolver`), stopped with the turn.
 */
@Injectable()
export class BotRuleReviewerFactory {
  constructor(private readonly completions: BotCompletionResolver) {}

  /** A reviewer for one turn, on its model, whose calls' spend is the bot's. */
  create(model: BotReviewEngine, bot: Omit<BotCompletionFor, 'purpose'>): BotRuleReviewer {
    return {
      review: async (call, rules) => {
        const answer = await this.completions.complete(
          {
            ...model,
            // A verdict needs little reasoning: the lowest effort the model offers,
            // or none where it offers no levels (null would be its default, not its least).
            effort: reviewEffort(model),
            systemPrompt: BOT_RULE_REVIEWER_PROMPT,
            message: composeRuleReview(call, rules),
            signal: AbortSignal.timeout(REVIEW_TIME_LIMIT_MS),
          },
          { ...bot, purpose: 'rule_review' },
        );
        return ruleVerdict(answer, rules);
      },
    };
  }
}
