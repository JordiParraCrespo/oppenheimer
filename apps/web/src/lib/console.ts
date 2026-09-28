import { createDialogSlot } from '@oppenheimer/frontend-web';
import { useMatchRoute } from '@tanstack/react-router';

/**
 * The console's dialogs, named by what opens them
 * (`product/versions/mvp/05-screens.md`, `13-automations.md`): New project
 * and Project settings, Add a host, New and Edit automation. A surface — a chip's
 * foot row, a sidebar button, a header's plus — only says which one to
 * open; one owner at the authenticated layout mounts it
 * (`providers/console-dialogs.tsx`).
 *
 * The callbacks carry what the dialog hands back to the surface that asked:
 * the project saved, the host paired.
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

const consoleDialogs = createDialogSlot<ConsoleDialogRequest>('useConsoleDialog');

/** Mounted once, around the authenticated shell. */
export const ConsoleDialogProvider = consoleDialogs.DialogSlotProvider;
/** `open` and `close`, from any surface under the authenticated layout; never re-renders it. */
export const useConsoleDialog = consoleDialogs.useDialogActions;
/** The dialog that is up; only `providers/console-dialogs.tsx` reads it. */
export const useConsoleDialogRequest = consoleDialogs.useDialogRequest;

/** The console's lists: what the rail switches and the sidebar shows. */
export type ConsoleList = 'sessions' | 'automations';

/**
 * Which of the console's lists the address is under: `automations` for
 * everything under `/automations`, the editor included, and `sessions` for
 * the rest. One predicate, asked of the router, so the rail's current item
 * and the sidebar beside it can never disagree.
 */
export function useConsoleList(): ConsoleList {
  const matchRoute = useMatchRoute();
  return matchRoute({ to: '/automations', fuzzy: true }) ? 'automations' : 'sessions';
}
