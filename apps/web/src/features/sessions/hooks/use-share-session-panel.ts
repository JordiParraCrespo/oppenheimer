import type { SessionShare } from '@oppenheimer/frontend-consumer';
import {
  usePutSessionShare,
  useSetSessionSharePeople,
  useStopSessionShare,
} from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import {
  effectiveAccess,
  lifetimeAllowed,
  SHARE_DEFAULTS,
  type ShareSettings,
  settingsOf,
  shareInput,
  withAccess,
} from '../lib/share-session';

/**
 * What Share decides, apart from how it is drawn: the three settings as the
 * menus show them, and every write the panel makes, over the share the panel
 * read (`null` while the session is not shared).
 *
 * A session not yet shared holds its settings as a draft that Invite or
 * Create link shares. On a live share a pick is sent as it is made, keeping
 * the address and, where the new choice allows, the share's end. Write access
 * asked of a live share is held (`asked`) until it is understood (`ack`),
 * and asks nothing once the share is gone. One write runs at a time: `busy`
 * holds every other control while one is in flight, so no two can send a
 * list built from the same old copy.
 */
export function useShareSessionPanel(sessionId: string, share: SessionShare | null) {
  const put = usePutSessionShare();
  const narrow = useSetSessionSharePeople();
  const stop = useStopSessionShare();
  const [draft, setDraft] = useState<ShareSettings>(SHARE_DEFAULTS);
  const [askedOf, setAsked] = useState<ShareSettings | null>(null);
  const asked = share ? askedOf : null;
  const [ack, setAck] = useState(false);
  // Whether the write in flight is Invite's, so its button alone says so.
  const [invited, setInvited] = useState(false);
  const busy = put.isPending || narrow.isPending || stop.isPending;

  // What the menus show: a live share's lifetime as it was picked; its time
  // left is the Expires button's own.
  const shown = asked ?? (share ? settingsOf(share, share.updatedAt.getTime()) : draft);
  const access = effectiveAccess(shown.audience, shown.access);

  /** What a pick changes: a live share as it is now, so its end does not move unasked. */
  function base(): ShareSettings {
    return asked ?? (share ? settingsOf(share, Date.now()) : draft);
  }

  function change(picked: Partial<ShareSettings>) {
    put.reset();
    const merged = { ...base(), ...picked };
    // A lifetime the access cannot have (write for 7 days) is never shown
    // and then sent shorter: it becomes write's shortest here.
    const next = lifetimeAllowed(effectiveAccess(merged.audience, merged.access), merged.lifetime)
      ? merged
      : { ...merged, lifetime: '1h' as const };
    if (!share) {
      if (next.access !== draft.access) setAck(false);
      setDraft(next);
      return;
    }
    if (effectiveAccess(next.audience, next.access) === 'write' && share.access !== 'write') {
      if (!asked) setAck(false);
      setAsked(next);
      return;
    }
    setAsked(null);
    put.mutate({ sessionId, input: shareInput(next, share.people) });
  }

  /** Give the write access asked of a live share, once it is understood. */
  function giveWrite(live: SessionShare, settings: ShareSettings) {
    put.mutate(
      { sessionId, input: shareInput(settings, live.people) },
      { onSuccess: () => setAsked(null) },
    );
  }

  /**
   * Invite: share a session not yet shared with them, as the menus say; add
   * them to a share for people, keeping the rest; or limit a link to them.
   */
  function invite(people: string[], done: () => void) {
    put.reset();
    narrow.reset();
    setInvited(true);
    const settle = { onSuccess: done, onSettled: () => setInvited(false) };
    if (!share) {
      put.mutate(
        { sessionId, input: shareInput(draft, people) },
        {
          ...settle,
          onSuccess: () => {
            setAck(false);
            done();
          },
        },
      );
    } else if (share.audience === 'people') {
      narrow.mutate({ sessionId, people: [...share.people, ...people] }, settle);
    } else {
      put.mutate(
        {
          sessionId,
          input: shareInput({ ...settingsOf(share, Date.now()), audience: 'people' }, people),
        },
        settle,
      );
    }
  }

  function stopSharing() {
    setAsked(null);
    stop.mutate({ sessionId });
  }

  /** × on a person; on the last one, stop sharing. */
  function remove(email: string) {
    if (!share) return;
    const people = share.people.filter((person) => person !== email);
    if (people.length) narrow.mutate({ sessionId, people });
    else stopSharing();
  }

  return {
    writeError: put.error ?? narrow.error ?? stop.error,
    shown,
    access,
    /** Write access is picked and not yet the share's: the warning shows. */
    writing: access === 'write' && share?.access !== 'write',
    asked,
    ack,
    setAck,
    busy,
    inviting: invited && busy,
    giving: put.isPending,
    stopping: stop.isPending,
    change,
    /** A permission picked: write starts on its shortest lifetime. */
    pickAccess: (next: ShareSettings['access']) => change(withAccess(base(), next)),
    cancelWrite: () => setAsked(null),
    giveWrite,
    invite,
    remove,
    stopSharing,
    createLink: () => put.mutate({ sessionId, input: shareInput(draft, []) }),
  };
}
