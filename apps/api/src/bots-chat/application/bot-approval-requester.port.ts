import type { BotToolSubject } from '../domain/bot-tool-permission.entity';

/** One call of an asking tool, as the owner will be asked about it. */
export interface BotApprovalCall {
  /** Which turn of which bot asks. */
  organizationId: string;
  botId: string;
  turnId: string;
  tool: string;
  /** The input exactly as the tool validated it. */
  input: Record<string, unknown>;
  /** What will happen, in words, built by the tool from its input. */
  summary: string;
  /** The one thing the call acts on, when the tool names one; the card offers to always allow it. */
  subject: BotToolSubject | null;
  /** The call sends data out of Oppenheimer; the card says so. */
  sharesOutside: boolean;
  /** Every call of the tool is decided on its own: the card offers this call only. */
  perCallOnly: boolean;
  /** Why a rule made it ask, or that the rules could not be checked; the card says it. */
  reviewNote?: string | null;
}

/**
 * What came of asking: a card is up, or one the bot raised earlier still
 * waits, and nothing more may be asked until the owner answers it.
 */
export type BotApprovalRequestOutcome =
  | { status: 'requested'; approvalId: string }
  | { status: 'waiting'; summary: string };

/**
 * How an asking tool asks under Approve for me (`25-bots.md` §5): it records
 * the call as a pending approval, the Needs input card, instead of running
 * it. One waits per bot at a time.
 */
export interface BotApprovalRequesterPort {
  request(call: BotApprovalCall): Promise<BotApprovalRequestOutcome>;
}
