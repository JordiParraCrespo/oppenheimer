import type { BotPermission } from '@oppenheimer/shared';
import { promptText } from './bot-prompt-text.policy';
import type { BotReviewedCall } from './bot-rule-review.policy';
import type { BotPermissions, BotToolTraits } from './bot-tool-permission.policy';
import { cut, neutraliseTags } from './bot-tool-text.policy';

/**
 * Approve for me (`auto`): before a call that would stop on a card, a
 * reviewer on the bot's own model decides whether it may run without the
 * owner (2026-11-25). Two designs shaped it:
 *
 * - Claude Code's auto mode: the reviewer reads the person's own messages
 *   and the action, never the bot's text or what its tools returned, so a
 *   page, an email or an issue the bot read cannot argue for the call it
 *   planted.
 * - Codex's auto review: the reviewer rates the call's risk and how far the
 *   owner authorised it, and the threshold between the two is fixed
 *   (`AUTO_REVIEW_THRESHOLD`), held here as well as in the prompt.
 *
 * It fails closed: an answer that cannot be read, or none, raises the card
 * the call would have raised without the reviewer. A call the reviewer will
 * not clear is not refused; the card is the fallback, so the owner always
 * has the last word and the bot never loops on refusals.
 */
export const BOT_AUTO_REVIEWER_PROMPT = promptText('core/job-auto-review.system');

export const AUTO_REVIEW_RISKS = ['low', 'medium', 'high', 'critical'] as const;
export type AutoReviewRisk = (typeof AUTO_REVIEW_RISKS)[number];

export const AUTO_REVIEW_AUTHORIZATIONS = ['none', 'low', 'medium', 'high'] as const;
export type AutoReviewAuthorization = (typeof AUTO_REVIEW_AUTHORIZATIONS)[number];

/**
 * The least authorisation each risk needs to run without the owner; null
 * never runs. Low runs at any; critical always asks.
 */
export const AUTO_REVIEW_THRESHOLD: Readonly<
  Record<AutoReviewRisk, AutoReviewAuthorization | null>
> = {
  low: 'none',
  medium: 'medium',
  high: 'high',
  critical: null,
};

/** The reviewer's verdict on one call. */
export interface BotAutoVerdict {
  outcome: 'allow' | 'ask';
  risk: AutoReviewRisk;
  authorization: AutoReviewAuthorization;
  /** One sentence, for the call's line or its card. */
  reason: string;
}

/** What the reviewer trusts: the owner's own words, never the bot's or a tool's. */
export interface BotAutoReviewContext {
  /** The bot's instructions as the owner wrote them; empty when none. */
  instructions: string;
  /** The owner's messages in this conversation, oldest first; none for a turn nobody of theirs opened. */
  ownerMessages: readonly string[];
}

/** How many of the owner's messages the reviewer reads, the newest. */
export const AUTO_REVIEW_OWNER_MESSAGES_MAX = 12;
/** How much of each part the reviewer reads, in characters. */
const AUTO_REVIEW_MESSAGE_CHARS = 2_000;
const AUTO_REVIEW_INSTRUCTIONS_CHARS = 4_000;
const AUTO_REVIEW_INPUT_CHARS = 4_000;
const AUTO_REVIEW_REASON_CHARS = 280;

const TAGS = ['owner_messages', 'owner_instructions', 'message', 'action'];

/**
 * Whether a call that stands at Ask goes to the reviewer before its card:
 * only under Approve for me, and only when it asks because of the catalog.
 * The owner's own Ask on a tool, and a tool that asks under every preset
 * until the owner allows it, keep their card: the owner's word stands, as an
 * ask rule keeps Claude Code's prompt in auto mode.
 */
export function autoReviews(
  permissions: BotPermissions,
  tool: BotToolTraits,
  preset: BotPermission,
): boolean {
  return preset === 'auto' && !tool.always && permissions.decisions.get(tool.name) !== 'ask';
}

/**
 * The owner's words a turn's reviewer reads: the person's messages in the
 * conversation, the newest `AUTO_REVIEW_OWNER_MESSAGES_MAX`, the opening
 * last; none when the turn is not the owner's own (another bot's message, a
 * background wake, a channel), since then nobody of theirs asked for anything.
 */
export function ownerMessagesFor(
  turn: { inConsole: boolean; lane: string },
  earlier: readonly { role: string; content: string }[],
  opening: { role: string; content: string } | null,
): string[] {
  if (!turn.inConsole || turn.lane !== 'owner') return [];
  const said = [...earlier, ...(opening ? [opening] : [])]
    .filter((message) => message.role === 'user' && message.content.trim())
    .map((message) => message.content.trim());
  return said.slice(-AUTO_REVIEW_OWNER_MESSAGES_MAX);
}

/** The reviewer's message: what the owner said and wrote, then the call, each fenced as data. */
export function composeAutoReview(call: BotReviewedCall, context: BotAutoReviewContext): string {
  let input: string;
  try {
    input = JSON.stringify(call.input ?? {});
  } catch {
    input = '{}';
  }
  const fenced = (text: string, max: number) => neutraliseTags(cut(text, max), TAGS);
  const messages = context.ownerMessages.length
    ? context.ownerMessages
        .map((text) => `<message>\n${fenced(text, AUTO_REVIEW_MESSAGE_CHARS)}\n</message>`)
        .join('\n')
    : '(none: nobody of the owner’s asked for anything in this turn)';
  return [
    `<owner_instructions>\n${fenced(context.instructions.trim() || '(none)', AUTO_REVIEW_INSTRUCTIONS_CHARS)}\n</owner_instructions>`,
    `<owner_messages>\n${messages}\n</owner_messages>`,
    '<action>',
    `tool: ${call.tool}`,
    `what it does: ${fenced(call.summary, AUTO_REVIEW_MESSAGE_CHARS)}`,
    `input: ${fenced(input, AUTO_REVIEW_INPUT_CHARS)}`,
    '</action>',
  ].join('\n');
}

/**
 * The verdict from the reviewer's answer. It allows only when the reviewer
 * said allow and the threshold agrees with the risk and the authorisation it
 * gave; the stricter of the two wins. Throws on an answer that is not the
 * JSON asked for, so the caller asks.
 */
export function autoVerdict(answer: string): BotAutoVerdict {
  const json = /\{[\s\S]*\}/.exec(answer)?.[0];
  if (!json) throw new Error('The auto review gave no verdict');
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const risk = oneOf(AUTO_REVIEW_RISKS, parsed.risk, 'risk');
  const authorization = oneOf(AUTO_REVIEW_AUTHORIZATIONS, parsed.authorization, 'authorization');
  const said = oneOf(['allow', 'ask'] as const, parsed.outcome, 'outcome');
  const reason =
    typeof parsed.reason === 'string' && parsed.reason.trim()
      ? cut(parsed.reason.trim(), AUTO_REVIEW_REASON_CHARS)
      : `${risk} risk`;
  const needed = AUTO_REVIEW_THRESHOLD[risk];
  const clears =
    needed !== null &&
    AUTO_REVIEW_AUTHORIZATIONS.indexOf(authorization) >= AUTO_REVIEW_AUTHORIZATIONS.indexOf(needed);
  return { outcome: said === 'allow' && clears ? 'allow' : 'ask', risk, authorization, reason };
}

function oneOf<T extends string>(values: readonly T[], value: unknown, field: string): T {
  if (typeof value === 'string' && (values as readonly string[]).includes(value)) return value as T;
  throw new Error(`The auto review gave no ${field}`);
}

/** A call the reviewer let run, as its step says it. */
export function autoAllowedLine(reason: string): string {
  return `Auto-approved: ${reason}`;
}

/** A call the reviewer would not clear, as its card says it. */
export function autoPausedNote(reason: string): string {
  return `Approve for me left this to you: ${reason}`;
}

/** A call whose review failed: it asks, and its card says why. */
export const AUTO_UNCHECKED_NOTE = 'Approve for me could not review this just now, so it asks.';
