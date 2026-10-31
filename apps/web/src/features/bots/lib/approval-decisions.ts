import type { BotApprovalDecision } from '@oppenheimer/shared/schemas/bot';

/**
 * How the Needs input card draws each decision the API offers it, in the
 * order it was given: its label, its look and its key (Codex's approval
 * keys: `y` yes, `p` for the prefix, here the call's subject, `a` always,
 * `n` no, `c` cancel, here stop). `deny` asks for a note before it answers;
 * every other decision answers at once.
 */
export interface ApprovalDecisionLook {
  decision: BotApprovalDecision;
  /** A key under `bots.chat.approval`. */
  label: 'approve' | 'approveOnce' | 'alwaysFor' | 'always' | 'deny' | 'stop';
  variant: 'primary' | 'secondary' | 'ghost';
  /** The key that picks it, as `KeyboardEvent.key` reads it. */
  shortcut: string;
  /** A key under `bots.chat.approval` saying what follows, for a no. */
  hint: 'denyHint' | 'stopHint' | null;
}

const LOOKS: Record<BotApprovalDecision, Omit<ApprovalDecisionLook, 'decision' | 'label'>> = {
  approve: { variant: 'primary', shortcut: 'y', hint: null },
  approve_for_subject: { variant: 'secondary', shortcut: 'p', hint: null },
  approve_always: { variant: 'secondary', shortcut: 'a', hint: null },
  deny: { variant: 'secondary', shortcut: 'n', hint: 'denyHint' },
  stop: { variant: 'ghost', shortcut: 'c', hint: 'stopHint' },
};

/**
 * The card's buttons, in the API's order. Always allow for … needs the
 * subject's name to say what it covers, so without one it is not drawn; a
 * plain yes says "once" when a wider yes stands beside it.
 */
export function approvalDecisionLooks(
  decisions: readonly BotApprovalDecision[],
  subjectLabel: string | null,
): ApprovalDecisionLook[] {
  const offered = decisions.filter(
    (decision) => decision !== 'approve_for_subject' || subjectLabel !== null,
  );
  const wider = offered.some(
    (decision) => decision === 'approve_for_subject' || decision === 'approve_always',
  );
  return offered.map((decision) => ({
    decision,
    label: labelOf(decision, wider),
    ...LOOKS[decision],
  }));
}

function labelOf(decision: BotApprovalDecision, wider: boolean): ApprovalDecisionLook['label'] {
  switch (decision) {
    case 'approve':
      return wider ? 'approveOnce' : 'approve';
    case 'approve_for_subject':
      return 'alwaysFor';
    case 'approve_always':
      return 'always';
    case 'deny':
      return 'deny';
    case 'stop':
      return 'stop';
  }
}

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
