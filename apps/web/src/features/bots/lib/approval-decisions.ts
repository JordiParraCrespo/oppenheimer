import type { ApprovalDecisionLook } from '@oppenheimer/frontend-consumer';
import type { BotApprovalDecision } from '@oppenheimer/shared/schemas/bot';

/**
 * The decision a key press picks, or null. Only a bare key: a modifier means
 * the press is someone else's (copy, a browser shortcut), and a press in a
 * field is writing.
 */
export function decisionForKey(
  looks: readonly ApprovalDecisionLook[],
  press: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; inField: boolean },
): BotApprovalDecision | null {
  if (press.ctrlKey || press.metaKey || press.altKey || press.inField) return null;
  const key = press.key.toLowerCase();
  return looks.find((look) => look.shortcut === key)?.decision ?? null;
}
