import { useState } from 'react';
import { type FailureIdentity, sameFailure } from '../lib/failure-identity';

/**
 * A failure the reader can close until a different one arrives. `identity` is
 * the failure on screen, `null` when there is none; a dismissal is forgotten
 * once the failure clears, so the same sentence after a retry shows again.
 */
export function useDismissible(identity: FailureIdentity | null) {
  const [dismissed, setDismissed] = useState<FailureIdentity | null>(null);
  // Adjusting state to a prop in render (React's documented pattern), not an effect.
  if (identity === null && dismissed !== null) setDismissed(null);
  return {
    dismissed: sameFailure(dismissed, identity),
    dismiss: () => setDismissed(identity),
  };
}
