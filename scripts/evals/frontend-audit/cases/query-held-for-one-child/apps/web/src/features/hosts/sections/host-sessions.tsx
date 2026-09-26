import { SessionItem, SessionList } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { Link } from '@tanstack/react-router';

/** The sessions one host is running, newest first. */
export function HostSessions({ hostId, sessions }: { hostId: string; sessions: SessionEntity[] }) {
  const mine = sessions.filter((session) => session.hostId === hostId);

  return (
    <SessionList>
      {mine.map((session) => (
        <SessionItem
          key={session.id}
          name={session.name}
          state={session.isProvisioning ? 'pending' : 'running'}
          render={<Link to="/sessions/$sessionId" params={{ sessionId: session.id }} />}
        />
      ))}
    </SessionList>
  );
}
