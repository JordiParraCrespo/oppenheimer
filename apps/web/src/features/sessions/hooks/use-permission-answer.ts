import {
  type ChatPendingPermission,
  type ChatTurn,
  pendingPermission,
} from '@oppenheimer/frontend-consumer';
import { useEffect, useState } from 'react';

/**
 * How long an answered card stays after its dialog has left the screen,
 * while the call it answered has no result yet: long enough to read
 * "Allowed", short enough that a long command it allowed does not hold the
 * composer away.
 */
const ANSWER_HOLD_MS = 1800;

/** The permission the person answered, and the option they picked. */
interface Answered {
  pending: ChatPendingPermission;
  option: number;
}

/**
 * The permission the chat's card draws, and the answer it holds: the one
 * the agent waits on now (`live`), or the one just answered, its pick
 * filled, until the transcript gives its call a result or a moment after
 * its dialog left the screen, whichever comes first. A new dialog always
 * wins over an answered one.
 */
export function usePermissionAnswer(
  turn: ChatTurn | undefined,
  live: ChatPendingPermission | null,
) {
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [expired, setExpired] = useState<Answered | null>(null);
  const gone = live === null && answered !== null && expired !== answered;

  // A timer: the card lets go of an answer whose dialog has left the screen.
  useEffect(() => {
    if (!gone || !answered) return;
    const timer = setTimeout(() => setExpired(answered), ANSWER_HOLD_MS);
    return () => clearTimeout(timer);
  }, [gone, answered]);

  let permission = live;
  if (!permission && answered && expired !== answered) {
    const open = pendingPermission(turn, answered.pending.prompt)?.call;
    if (open && open.id === answered.pending.call?.id) permission = answered.pending;
  }
  // An answer holds for the dialog it answered, never for a later one with the
  // same words: the agent running the same command again draws a byte-identical
  // dialog, which is a new question. So it must be the same call, and not let go.
  const picked =
    permission &&
    answered &&
    expired !== answered &&
    answered.pending.prompt.id === permission.prompt.id &&
    (answered.pending.call?.id ?? null) === (permission.call?.id ?? null)
      ? answered.option
      : null;

  return {
    permission,
    picked,
    took: (pending: ChatPendingPermission, option: number) => setAnswered({ pending, option }),
  };
}
