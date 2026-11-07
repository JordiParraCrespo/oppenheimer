import { useSyncExternalStore } from 'react';
import {
  newSessionTask,
  setNewSessionTask,
  subscribeNewSessionTask,
} from '../lib/new-session-task';

/**
 * New session's task and its setter, for the composer. The setter takes an
 * update too, the shape dictation appends through.
 */
export function useNewSessionTask(): [string, (next: string | ((held: string) => string)) => void] {
  const text = useSyncExternalStore(subscribeNewSessionTask, newSessionTask);
  return [
    text,
    (next) => setNewSessionTask(typeof next === 'function' ? next(newSessionTask()) : next),
  ];
}
