/**
 * Where a stopped session's way back stands, decided in one place: whether
 * opening it should ask its host for it, and what its pane says meanwhile.
 * The hook gathers the facts and the pane draws the answer; neither decides.
 *
 * The one invariant: Restarting holds from the ask (or the open that is
 * about to ask) until the terminal is back, the request fails, or the
 * restart watch gives up on the host.
 */

/** The restart this pane asked for, if any, as the request stands. */
export type RestartRequest =
  | { state: 'none' }
  | { state: 'pending' }
  /** The API took it; `answered` is the stop it answered, by the host's stamp. */
  | { state: 'sent'; answered: number | null }
  | { state: 'failed'; error: unknown };

export type RestartFacts = {
  /** The pane restarts what it was opened on (`SessionPane`'s `restartOnOpen`). */
  auto: boolean;
  /** Stopped, and able to come back: not deleted, starting, failed or a cloud session, and on a host. */
  qualifies: boolean;
  /** It qualified when the pane mounted: what was opened, not what stopped since. */
  qualifiedWhenOpened: boolean;
  /** Its host is online; `undefined` while that is not known yet. A host list that failed is `false`. */
  hostOnline: boolean | undefined;
  /** When the session last stopped, by the host's stamp; `null` while it runs. */
  stoppedAt: number | null;
  request: RestartRequest;
  /** The restart watch gave up on the host. */
  timedOut: boolean;
};

export type RestartStatus =
  | { kind: 'stopped' }
  | { kind: 'restarting' }
  | { kind: 'failed'; error: unknown }
  /** The host never brought the terminal back: the failure has no error of its own. */
  | { kind: 'timed-out' };

/** Whether opening the pane asks for the session back now. */
export function asksOnOpen(facts: RestartFacts): boolean {
  return (
    facts.auto &&
    facts.qualifiedWhenOpened &&
    facts.qualifies &&
    facts.hostOnline === true &&
    facts.request.state === 'none'
  );
}

export function restartStatus(facts: RestartFacts): RestartStatus {
  const { request } = facts;
  switch (request.state) {
    case 'pending':
      return { kind: 'restarting' };
    case 'failed':
      return { kind: 'failed', error: request.error };
    case 'sent':
      // A stop after the one answered (Stop pressed once the terminal was
      // back) is a stop to show, not this restart still coming.
      if (!facts.qualifies || facts.stoppedAt !== request.answered) return { kind: 'stopped' };
      return facts.timedOut ? { kind: 'timed-out' } : { kind: 'restarting' };
    case 'none':
      // About to ask: an open reads as restarting from its first frame, not
      // as a Restart button that presses itself.
      return facts.auto &&
        facts.qualifiedWhenOpened &&
        facts.qualifies &&
        facts.hostOnline !== false
        ? { kind: 'restarting' }
        : { kind: 'stopped' };
  }
}
