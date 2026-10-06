import { createDialogSlot } from '@oppenheimer/frontend-web';
import { useMatches } from '@tanstack/react-router';

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
 * Which of the console's lists the matched routes are under: `automations`
 * for everything under `/automations`, the editor included; `pulls` for the
 * queue, a pull request and analytics under `/pulls`; Plan's two,
 * `calendar` under `/plan/calendar` (Google's return included) and `tasks`
 * for the rest of `/plan`; and `sessions` for everything else. One predicate,
 * so the rail's current item and the sidebar beside it can never disagree.
 * It reads the matches, not the address: the address moves on while the next
 * route still loads, and a list drawn ahead of its route reads a match that
 * is not there yet.
 */
export function useConsoleList(): ConsoleList {
  return useMatches({
    select: (matches): ConsoleList => {
      const ids = matches.map((match) => match.routeId);
      if (ids.some((id) => id.startsWith('/_authenticated/automations'))) return 'automations';
      // The queue and analytics under the `pulls` layout, and a pull request un-nested from it (`pulls_`).
      if (ids.some((id) => id.startsWith('/_authenticated/pulls'))) return 'pulls';
      if (ids.some((id) => id.startsWith('/_authenticated/plan/calendar'))) return 'calendar';
      if (ids.some((id) => id.startsWith('/_authenticated/plan/'))) return 'tasks';
      return 'sessions';
    },
  });
}
