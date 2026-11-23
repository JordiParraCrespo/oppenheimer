import { type SetStateAction, useCallback, useSyncExternalStore } from 'react';
import { storedLists } from '../lib/stored-list';

/** A list of ids kept in `key` on this device, shared by every reader of `key` (`storedLists`). */
export function useStoredList(key: string) {
  const list = useSyncExternalStore(
    useCallback((onChange: () => void) => storedLists.subscribe(key, onChange), [key]),
    () => storedLists.read(key),
  );
  const setList = useCallback(
    (action: SetStateAction<string[]>) => storedLists.write(key, action),
    [key],
  );

  return [list, setList] as const;
}
