import { type ReactNode, useState } from 'react';
import { ConsoleDialogContext, type ConsoleDialogRequest } from '../hooks/use-console-dialog';

/**
 * The one owner of which console dialog is up. The authenticated layout
 * mounts it once around the shell and renders the dialogs from its
 * `request`; every surface under it opens one through `useConsoleDialog`.
 * One slot, so two surfaces can never hold two dialogs of the same kind.
 */
export function ConsoleDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConsoleDialogRequest | null>(null);
  return (
    <ConsoleDialogContext.Provider
      value={{ request, open: setRequest, close: () => setRequest(null) }}
    >
      {children}
    </ConsoleDialogContext.Provider>
  );
}
