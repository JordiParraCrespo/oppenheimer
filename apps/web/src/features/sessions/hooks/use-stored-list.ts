import { useEffect, useState } from 'react';
import { rememberList, storedList } from '../lib/stored-list';

/** A list of ids kept in `key` on this device: read once, written on every change. */
export function useStoredList(key: string) {
  const [list, setList] = useState<string[]>(() => storedList(key));

  useEffect(() => rememberList(key, list), [key, list]);

  return [list, setList] as const;
}
