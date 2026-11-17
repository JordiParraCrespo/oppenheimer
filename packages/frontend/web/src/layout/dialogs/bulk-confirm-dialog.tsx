import { type ReactNode, useState } from 'react';
import { ErrorAlert } from '../../forms';
import { ConfirmDialog } from './confirm-dialog';

/**
 * "Delete these N?" for a list's selection: one write per item, side by side,
 * each landing as a single one does. When some fail, the dialog stays with
 * them: `onLeft` hands the list the keys still picked, the first failure says
 * why under `partial(count)`, and the confirm button tries them again. When
 * all land it closes. `onDone` gets the items that landed, for the toast.
 *
 * The words are the caller's, each a function of how many are left, so the
 * title and the button count down as a retry narrows the list.
 */
export function BulkConfirmDialog<T>({
  items,
  keyOf,
  run,
  title,
  description,
  confirmLabel,
  pendingLabel,
  partial,
  errorFallback,
  onDone,
  onLeft,
  onClose,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  /** The write for one item; a rejection keeps it picked. */
  run: (item: T) => Promise<unknown>;
  title: (count: number) => ReactNode;
  description: ReactNode;
  confirmLabel: (count: number) => string;
  pendingLabel?: string;
  /** Over the first failure: "2 tasks were not deleted". */
  partial: (count: number) => string;
  /** Already translated: the failure's words when its code has none. */
  errorFallback: string;
  onDone?: (landed: T[]) => void;
  /** The keys a write failed on, to keep picked; empty once all landed. */
  onLeft: (keys: string[]) => void;
  onClose: () => void;
}) {
  const [left, setLeft] = useState<readonly T[]>(items);
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    const results = await Promise.allSettled(left.map((item) => run(item)));
    setPending(false);
    const failed = left.filter((_, index) => results[index]?.status === 'rejected');
    const landed = left.filter((_, index) => results[index]?.status === 'fulfilled');
    if (landed.length > 0) onDone?.(landed);
    onLeft(failed.map(keyOf));
    if (failed.length === 0) {
      onClose();
      return;
    }
    const first = results.find((result) => result.status === 'rejected');
    setFailure(first?.status === 'rejected' ? first.reason : null);
    setLeft(failed);
  }

  return (
    <ConfirmDialog
      title={title(left.length)}
      description={description}
      confirmLabel={confirmLabel(left.length)}
      pendingLabel={pendingLabel}
      pending={pending}
      onClose={onClose}
      onConfirm={() => void confirm()}
    >
      {failure ? (
        <ErrorAlert title={partial(left.length)} error={failure} fallback={errorFallback} />
      ) : null}
    </ConfirmDialog>
  );
}
