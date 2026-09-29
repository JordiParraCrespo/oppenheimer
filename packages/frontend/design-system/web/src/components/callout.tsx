import type * as React from 'react';

import { Alert, AlertDescription, type AlertTone } from './alert';

/**
 * Callout — a note in the flow: the `Alert` box with one sentence and no
 * action. `neutral` is the default and carries no hue, because most notes are
 * explanations, not state; a tinted tone only when something is in that state.
 *
 * ```tsx
 * <Callout tone="warning">This host has been unreachable for 6 minutes. Sessions on it are paused.</Callout>
 * ```
 */
function Callout({ children, ...props }: React.ComponentProps<typeof Alert>) {
  return (
    <Alert {...props}>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

type CalloutTone = AlertTone;

export { Callout };
export type { CalloutTone };
