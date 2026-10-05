import type { RunnerCapability } from './messages.js';
import { isSessionImageType } from './session-file.js';

/** How files reach a runner: pasted into a window, or attached to a first task. */
export type SessionFileGesture = 'paste' | 'create';

/** What lets a runner take any file by each gesture: the images it was built for. */
const GESTURE_CAPABILITY = {
  paste: 'session.image',
  create: 'session.create.images',
} as const satisfies Record<SessionFileGesture, RunnerCapability>;

/**
 * The one question every sender asks before files go to a runner: may these
 * types go by this gesture to a runner whose `hello` named `capabilities`?
 * Answers the capability it is missing, or `null` when it takes them.
 *
 * The gesture's own capability (`session.image` to paste, and
 * `session.create.images` to attach to a first task) says it takes files that
 * way at all, as the images it was built for. `session.files` widens the
 * types, PDF and text, for both gestures; it never stands in for the
 * gesture's capability. The relay's dispatch and the create's preflight both
 * ask this, so they cannot disagree about one runner.
 */
export function missingFileCapability(
  capabilities: readonly string[],
  gesture: SessionFileGesture,
  mediaTypes: readonly string[],
): RunnerCapability | null {
  if (mediaTypes.length === 0) return null;
  const takesFiles = GESTURE_CAPABILITY[gesture];
  if (!capabilities.includes(takesFiles)) return takesFiles;
  if (!mediaTypes.every(isSessionImageType) && !capabilities.includes('session.files')) {
    return 'session.files';
  }
  return null;
}
