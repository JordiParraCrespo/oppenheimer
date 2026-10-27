import { Wordmark } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';

/**
 * The whole page of a shared session (`ShareSession.dc.html`): no console
 * around it, since the session is not the guest's — the wordmark on its own
 * row, and under it one card, 760px at most, that the session fills.
 */
export function SharedFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <div className="flex h-14 shrink-0 items-center px-5">
        <Wordmark size={17} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3.5 pt-0">
        <div className="mx-auto flex min-h-0 w-full max-w-190 flex-1 flex-col overflow-hidden bg-card">
          {children}
        </div>
      </div>
    </div>
  );
}
