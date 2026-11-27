import type { BotPermission } from '@oppenheimer/shared';
import { grantedLine } from './bot-approval.policy';
import { autoReviews } from './bot-auto-review.policy';
import { rulesToReview } from './bot-rule-review.policy';
import type { BotPermissions, BotToolTraits } from './bot-tool-permission.policy';

/**
 * How an asking tool's call is decided, as one value the tool factory runs:
 * which checks it goes through, in which order, and what happens when none
 * of them settles it. The order is the whole contract, written once here:
 *
 * 1. A call that escalates raises a card of its own offering only this call,
 *    whatever Settings, a standing grant, a rule or the reviewer would let
 *    run; never under Full access, which raises none.
 * 2. A call that would run (Full access, or set to Allow) is read against
 *    the owner's ask rules, when it has any: a match raises the card.
 * 3. A call that would ask runs on a standing grant for the thing it acts on.
 * 4. Then the owner's rules: an ask rule raises the card, an allow rule no ask
 *    rule overrides runs it. Under Auto every rule is read, so an
 *    ask rule keeps the card the owner wanted before the reviewer runs.
 * 5. Then, under Auto, the reviewer (`autoReviews`), which runs the
 *    call or raises the card.
 * 6. Otherwise the call raises the card.
 *
 * A review that fails settles as ask (fail closed), so no step falls through
 * to running a call it could not check.
 */

/** A check a call goes through, run by the factory: the owner's rules, or the reviewer. */
export type BotApprovalReview = 'rules' | 'auto';

export type BotApprovalPlan =
  | { kind: 'escalate' }
  | { kind: 'run'; line: string | null }
  | {
      kind: 'review';
      /** In order; the first that settles decides. */
      reviews: readonly BotApprovalReview[];
      /** The rules the `rules` review reads. */
      rules: BotPermissions['rules'];
      /** What a call no review settled does. */
      otherwise: 'run' | 'ask';
    };

/** What one review said: run (and why), ask (and why), or nothing either way. */
export type BotApprovalVerdict =
  | { effect: 'allow'; line: string }
  | { effect: 'ask'; note: string | null }
  | { effect: 'none' };

/** Where a call ends: it runs (its step saying why, when it would have asked), or it raises its card. */
export type BotApprovalOutcome =
  | { kind: 'run'; line: string | null }
  | { kind: 'ask'; note: string | null };

export function approvalPlan(input: {
  preset: BotPermission;
  permissions: BotPermissions;
  traits: BotToolTraits;
  /** The call stands at Ask (`toolDecision`). */
  asks: boolean;
  /** The tool says this call reaches further than its grants (`escalates`). */
  escalates: boolean;
  /** A standing grant for the call's subject; read only when the call asks. */
  granted: { label: string } | null;
  /** Which reviewers the turn has. */
  reviewers: { rules: boolean; auto: boolean };
}): BotApprovalPlan {
  const { preset, permissions, traits } = input;
  if (input.escalates && preset !== 'full') return { kind: 'escalate' };
  if (!input.asks) {
    const rules = traits.asks ? rulesToReview(permissions, 'allow') : [];
    return rules.length > 0 && input.reviewers.rules
      ? { kind: 'review', reviews: ['rules'], rules, otherwise: 'run' }
      : { kind: 'run', line: null };
  }
  if (input.granted) return { kind: 'run', line: grantedLine(input.granted.label) };
  const auto = input.reviewers.auto && autoReviews(permissions, traits, preset);
  const rules = auto ? permissions.rules : rulesToReview(permissions, 'ask');
  const reviews: BotApprovalReview[] = [];
  if (rules.length > 0 && input.reviewers.rules) reviews.push('rules');
  if (auto) reviews.push('auto');
  return { kind: 'review', reviews, rules, otherwise: 'ask' };
}

/**
 * Runs a plan's reviews in order through `review` and says where the call
 * ends: the first verdict that is not `none` settles it. An allow on a call
 * that would have run anyway carries no line, since nothing was let through.
 */
export async function decideApproval(
  plan: Extract<BotApprovalPlan, { kind: 'review' }>,
  review: (kind: BotApprovalReview) => Promise<BotApprovalVerdict>,
): Promise<BotApprovalOutcome> {
  for (const kind of plan.reviews) {
    const verdict = await review(kind);
    if (verdict.effect === 'allow') {
      return { kind: 'run', line: plan.otherwise === 'ask' ? verdict.line : null };
    }
    if (verdict.effect === 'ask') return { kind: 'ask', note: verdict.note };
  }
  return plan.otherwise === 'run' ? { kind: 'run', line: null } : { kind: 'ask', note: null };
}
