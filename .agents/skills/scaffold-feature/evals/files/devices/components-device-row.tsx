import { Badge, Button } from '@oppenheimer/design-system-web';
import type { UserSessionEntity } from '@oppenheimer/frontend-consumer';

export function DeviceRow({
  session,
  filter,
  pending,
  onRevoke,
}: {
  session: UserSessionEntity;
  filter: string;
  pending: boolean;
  onRevoke: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3" data-filter={filter}>
      <div>
        <div className="font-medium">{session.userAgent ?? 'Unknown device'}</div>
        <div className="text-sm text-gray-500">
          Last seen {session.lastSeenAt.toLocaleDateString()}
        </div>
      </div>
      {session.current ? (
        <Badge variant="secondary">This device</Badge>
      ) : (
        <Button variant="destructive" disabled={pending} onClick={onRevoke}>
          Sign out
        </Button>
      )}
    </div>
  );
}
