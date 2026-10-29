import { BOT_ASK_USER_TOOL, type BotApprovalEvent } from '@oppenheimer/shared/schemas/bot';

/**
 * How a decided card's line reads, as its key under `bots.chat.event`: a
 * call approved, denied or failed, or questions answered or dismissed (a
 * card of `ask_user` questions that was denied).
 */
export function approvalEventKey(
  event: BotApprovalEvent,
): 'approved' | 'denied' | 'failed' | 'answered' | 'dismissed' {
  if (event.tool === BOT_ASK_USER_TOOL && event.outcome === 'denied') return 'dismissed';
  return event.outcome;
}

/** The decided card as the export writes it: its line, then each question with its answer. */
export function approvalEventText(event: BotApprovalEvent, line: string): string {
  const answers = (event.answers ?? []).map(({ question, answer }) => `- ${question} ${answer}`);
  return [line, ...answers].join('\n');
}
