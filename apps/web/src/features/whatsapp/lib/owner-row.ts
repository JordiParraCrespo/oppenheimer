import type { WhatsappOwnerState } from '@oppenheimer/frontend-consumer';

/** What the "Your number" row asks for: a number, the code, a new code, or nothing. */
export type OwnerStep = 'number' | 'code' | 'expired' | 'confirmed';

/**
 * Which step the "Your number" row is on, from where the owner stands and
 * what the reader is doing: a number to name (none yet, or Change pressed),
 * the code that waits (or a new one, once it has expired), or the confirmed
 * number. Change and Use another number go back to the number, and Cancel
 * returns to wherever the owner stands.
 */
export function ownerStep(state: {
  ownerState: WhatsappOwnerState;
  codeExpired: boolean;
  changing: boolean;
}): OwnerStep {
  if (state.changing || state.ownerState === 'none') return 'number';
  if (state.ownerState === 'confirmed') return 'confirmed';
  return state.codeExpired ? 'expired' : 'code';
}
