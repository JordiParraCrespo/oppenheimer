import type { BotApprovalDecision } from '@oppenheimer/shared/schemas/bot';
import { useEffect, useEffectEvent } from 'react';
import { type ApprovalDecisionLook, decisionForKey } from '@/features/bots/lib/approval-decisions';

/** Whether a key press lands where someone writes: then it is a letter, not a decision. */
function inField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * The card's keys (`y`, `p`, `a`, `n`, `c`, as each button shows): a bare
 * press anywhere but a field picks that decision. Off while `enabled` is
 * false (a request in flight, the note open).
 */
export function useApprovalShortcuts(
  looks: readonly ApprovalDecisionLook[],
  enabled: boolean,
  onDecide: (decision: BotApprovalDecision) => void,
): void {
  const press = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.repeat) return;
    const decision = decisionForKey(looks, {
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      inField: inField(event.target),
    });
    if (!decision) return;
    event.preventDefault();
    onDecide(decision);
  });

  // Listens to the document's key presses, a DOM event outside React, while the card is up.
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => press(event);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
