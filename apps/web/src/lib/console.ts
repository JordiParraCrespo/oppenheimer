import { createDialogSlot } from '@oppenheimer/frontend-web';
import { useMatchRoute } from '@tanstack/react-router';

/**
 * The console's dialogs, named by what opens them
 * (`product/versions/mvp/05-screens.md`, `13-automations.md`). A surface only
 * says which one to open; one owner at the authenticated layout mounts it
 * (`providers/console-dialogs.tsx`). The callbacks carry what the dialog hands
 * back to the surface that asked.
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
export type ConsoleList = 'sessions' | 'automations' | 'pulls' | 'tasks' | 'calendar';

/**
 * Which of the console's lists the address is under: `automations` for
 * everything under `/automations`, the editor included; `pulls` for the
 * queue, a pull request and analytics under `/pulls`; Plan's two, `calendar`
 * under `/plan/calendar` (Google's return included) and `tasks` for the rest
 * of `/plan`; and `sessions` for everything else. One predicate, asked of the
 * router, so the rail's current item and the sidebar beside it can never
 * disagree.
 */
export function useConsoleList(): ConsoleList {
  const matchRoute = useMatchRoute();
  if (matchRoute({ to: '/automations', fuzzy: true })) return 'automations';
  if (matchRoute({ to: '/pulls', fuzzy: true })) return 'pulls';
  if (matchRoute({ to: '/plan/calendar', fuzzy: true })) return 'calendar';
  if (matchRoute({ to: '/plan', fuzzy: true })) return 'tasks';
  return 'sessions';
}
