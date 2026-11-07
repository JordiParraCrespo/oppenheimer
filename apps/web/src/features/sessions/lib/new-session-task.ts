import { type StoredTexts, storedTexts } from '@oppenheimer/frontend-web';

/**
 * What is being written in New session's composer, kept while you are away
 * from the screen (the kit's `storedTexts`), so opening a session and coming
 * back, or reloading the page, keeps a half-written task. The files held
 * beside it are not kept.
 */
export const newSessionTexts: StoredTexts = storedTexts('oppenheimer.new-session.');

/** The one text New session keeps, under `oppenheimer.new-session.task`. */
export const NEW_SESSION_TASK = 'task';

/** The task being written. */
export function newSessionTask(): string {
  return newSessionTexts.read(NEW_SESSION_TASK);
}

export function setNewSessionTask(text: string): void {
  newSessionTexts.write(NEW_SESSION_TASK, text);
}

/**
 * Forgets the task once a session has started from it: only when what was
 * sent is what is still held. A blank terminal sent no task, and a task
 * rewritten while the request was in flight was not sent, so both stay.
 */
export function forgetSentTask(sent: string | undefined): void {
  if (sent && newSessionTask().trim() === sent) setNewSessionTask('');
}
