import { SessionList, useNow } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { SessionRow } from './session-row';

/**
 * A group's rows, under a project or under Pinned. It owns the ages' clock,
 * ticking once a minute: every row redraws on the tick, because every age may
 * have moved, and the group's header around them does not.
 */
export function SessionRows({
  sessions,
  dragDisabled,
  onShare,
  onDelete,
  onWrite,
}: {
  sessions: SessionEntity[];
  dragDisabled: boolean;
  onShare: (session: SessionEntity) => void;
  onDelete: (session: SessionEntity) => void;
  onWrite: (error: Error | null) => void;
}) {
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  return (
    <SessionList>
      {sessions.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          now={now}
          onShare={onShare}
          dragDisabled={dragDisabled}
          onDelete={onDelete}
          onWrite={onWrite}
        />
      ))}
    </SessionList>
  );
}
