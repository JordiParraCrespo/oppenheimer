import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { BotEngine, BotTurnRequest } from '@oppenheimer/backend-agents';
import { BOT_ENGINE } from '../bots-chat.di-tokens';
import {
  BOT_RULE_REVIEWER_PROMPT,
  type BotReviewedCall,
  type BotRuleVerdict,
  composeRuleReview,
  ruleVerdict,
} from '../domain/bot-rule-review.policy';
import type { BotPermissions } from '../domain/bot-tool-permission.policy';

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
 * turn's own provider, model and key, one completion per call with no tools,
 * in a scratch directory of its own, stopped with the turn.
 */
@Injectable()
export class BotRuleReviewerFactory {
  constructor(@Inject(BOT_ENGINE) private readonly engine: BotEngine) {}

  create(model: BotReviewEngine): BotRuleReviewer {
    return {
      review: async (call, rules) => {
        const scratchDir = await mkdtemp(join(tmpdir(), 'bot-review-'));
        try {
          const answer = await this.engine.complete({
            ...model,
            // A yes or no over a few rules: the model's least effort is enough.
            effort: null,
            systemPrompt: BOT_RULE_REVIEWER_PROMPT,
            message: composeRuleReview(call, rules),
            signal: AbortSignal.timeout(REVIEW_TIME_LIMIT_MS),
            scratchDir,
          });
          return ruleVerdict(answer, rules);
        } finally {
          await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
        }
      },
    };
  }
}
