import { createContext, useContext } from 'react';

/**
 * The console's dialogs, named by what opens them
 * (`product/versions/mvp/05-screens.md`, `13-automations.md`): New project
 * and Project settings, Add a host, New and Edit automation. A surface — a chip's
 * foot row, a sidebar button, a header's plus — only says which one to
 * open; one owner at the authenticated layout mounts it.
 *
 * The callbacks carry what the dialog hands back to the surface that asked:
 * the project saved, the host paired. Structural, because the kit imports
 * no product package.
 */
export type ConsoleDialogRequest =
  | {
      kind: 'project';
      /** Present edits this project; absent creates one. */
      projectId?: string;
      onSaved?: (project: { id: string }) => void;
    }
  | { kind: 'add-host'; onUseHost?: (hostId: string) => void }
  | {
      kind: 'automation';
      /** Present edits this automation; absent creates one. */
      automationId?: string;
      /** The project a header's plus opened it for. */
      projectId?: string;
      onSaved?: (automation: { id: string }) => void;
    };

export interface ConsoleDialogs {
  /** The dialog that is up, if one is. */
  request: ConsoleDialogRequest | null;
  open: (request: ConsoleDialogRequest) => void;
  close: () => void;
}

export const ConsoleDialogContext = createContext<ConsoleDialogs | null>(null);

/** Which console dialog to open, from any surface under the authenticated layout. */
export function useConsoleDialog(): ConsoleDialogs {
  const dialogs = useContext(ConsoleDialogContext);
  if (!dialogs) throw new Error('useConsoleDialog must be used within <ConsoleDialogProvider>');
  return dialogs;
}
