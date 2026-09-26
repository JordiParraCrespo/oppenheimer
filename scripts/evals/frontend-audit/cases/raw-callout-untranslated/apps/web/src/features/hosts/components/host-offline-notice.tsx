import type { HostEntity } from '@oppenheimer/frontend-consumer';

/** Shown over a session whose host has stopped answering. */
export function HostOfflineNotice({ host }: { host: HostEntity }) {
  return (
    <div role="alert" className="flex flex-col gap-1 rounded-md border border-border p-3">
      <p className="text-fg">{host.name} is offline</p>
      <p className="text-fg-muted">
        The terminal will reconnect when the runner is back. Check that the machine is awake.
      </p>
    </div>
  );
}
