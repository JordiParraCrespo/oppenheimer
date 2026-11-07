/**
 * What is being written in New session's composer, kept while you are away
 * from the screen: in memory and in this browser's storage, so opening a
 * session and coming back, or reloading the page, keeps a half-written task.
 * It is forgotten once a session starts from it. Storage is a convenience:
 * when it is blocked (a private window, cleared site data) the text lives as
 * long as the tab. The files held beside it are not kept.
 *
 * A store outside React because the composer writes it as you type and the
 * send forgets it on success, and the composer unmounts in between.
 */

const STORAGE_KEY = 'oppenheimer.new-session.task';

let task: string | undefined;
const listeners = new Set<() => void>();

function stored(): string {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function store(text: string): void {
  try {
    if (text) globalThis.localStorage?.setItem(STORAGE_KEY, text);
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Blocked storage keeps the text in memory only.
  }
}

/** The task being written: what was last typed, or what this browser kept. */
export function newSessionTask(): string {
  if (task === undefined) task = stored();
  return task;
}

/** Writes the task being written; an empty one is forgotten. */
export function setNewSessionTask(text: string): void {
  if (newSessionTask() === text) return;
  task = text;
  store(text);
  for (const listener of listeners) listener();
}

/** Called whenever the task changes; returns the unsubscribe. */
export function subscribeNewSessionTask(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
