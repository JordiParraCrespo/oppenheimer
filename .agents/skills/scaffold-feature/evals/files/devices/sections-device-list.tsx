import { Input } from '@oppenheimer/design-system-web';
import type { UserSessionEntity } from '@oppenheimer/frontend-consumer';
import { useRevokeProfileSession } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useState } from 'react';
import { DeviceRow } from '@/features/profile/components/device-row';

export function DeviceList({
  sessions,
  loading,
}: {
  sessions: UserSessionEntity[];
  loading: boolean;
}) {
  const [filter, setFilter] = useState('');
  const [visible, setVisible] = useState<UserSessionEntity[]>([]);
  const revoke = useRevokeProfileSession();

  useEffect(() => {
    setVisible(
      sessions.filter((session) => (session.userAgent ?? '').toLowerCase().includes(filter)),
    );
  }, [sessions, filter]);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="flex flex-col gap-3">
      <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter" />
      {visible.length === 0 && <p className="text-muted-foreground">No devices</p>}
      {visible.map((session) => (
        <DeviceRow
          key={session.id}
          session={session}
          filter={filter}
          pending={revoke.isPending}
          onRevoke={() => revoke.mutate(session.id)}
        />
      ))}
    </div>
  );
}
