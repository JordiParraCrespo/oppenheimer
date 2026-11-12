import type { InboxItem } from '@oppenheimer/frontend-consumer';
import {
  useDeleteInboxMark,
  usePutInboxMark,
  usePutInboxMarks,
  useTriageTask,
} from '@oppenheimer/frontend-consumer/react';
import { INBOX_MARK_ACTIONS, type InboxMarkActionName } from '../lib/inbox-mark-actions';

/**
 * Does an Inbox action (`INBOX_MARK_ACTIONS`) to one item, through its own
 * mark, or to a selection, in one request. `error` is the last write the
 * server refused; the list draws it. An action that also puts a source away
 * (`takesUp`: Delete on a task an agent made) does that too.
 */
export function useInboxMarks() {
  // The stable parts only: the mutation result itself is a new object on
  // every render, and the rows' handlers are built from these.
  const { mutate: put, error: putError, reset: resetPut } = usePutInboxMark();
  const { mutate: clear, error: clearError, reset: resetClear } = useDeleteInboxMark();
  const { mutate: putAll, error: allError, reset: resetAll } = usePutInboxMarks();
  const { mutate: triage, error: triageError, reset: resetTriage } = useTriageTask();

  return {
    error: putError ?? clearError ?? allError ?? triageError,
    dismiss: () => {
      resetPut();
      resetClear();
      resetAll();
      resetTriage();
    },
    apply(action: InboxMarkActionName, target: InboxItem | readonly InboxItem[]) {
      const items = 'key' in target ? [target] : target;
      if (items.length === 0) return;
      const { write, visit, takesUp } = INBOX_MARK_ACTIONS[action];
      const { mark, until } = write(items, new Date());
      if (items.length > 1) {
        putAll({ itemKeys: items.map((item) => item.key), mark, until });
      } else if (mark === null) {
        clear(items[0].key);
      } else {
        put({ itemKey: items[0].key, mark, until });
      }
      for (const item of items) {
        const taskId = takesUp?.(item);
        if (taskId) triage(taskId);
      }
      if (visit) for (const item of items) visit(item.key);
    },
  };
}
