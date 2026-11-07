import { withFold } from '../lib/stored-list';
import { useStoredList } from './use-stored-list';

/**
 * Whether the list `id` names is open, and the toggle that folds it, kept in
 * `key` beside the other folds of that kind on this device. A fold is the
 * reader's, so the API never hears of it.
 */
export function useStoredFold(key: string, id: string) {
  const [folded, setFolded] = useStoredList(key);
  return {
    open: !folded.includes(id),
    setOpen: (open: boolean) => setFolded((current) => withFold(current, id, open)),
  };
}
