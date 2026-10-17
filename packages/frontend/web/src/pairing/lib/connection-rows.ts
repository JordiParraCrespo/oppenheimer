/** Where a Connection row stands: behind the stage in progress, on it, or past it. */
export type ConnectionRowState = 'done' | 'current' | 'next';

/** The machine as the Connection list reads it. */
export interface ConnectionMachine {
  name: string;
  online: boolean;
  os: string | null;
  runnerVersion: string | null;
}

export interface ConnectionRow {
  key: 'installed' | 'connected';
  state: ConnectionRowState;
  /** A `hosts.pairing.*` key. */
  label: 'installWaiting' | 'installed' | 'connected';
  /** What the runner reported, shown once the row is done. */
  detail: string | null;
}

/**
 * The Connection list's rows, from the machine a token paired. Runner
 * installed is the host row existing (the runner registered, with its
 * version); Host connected is the runner dialled in (its name and OS). The
 * first row not done is the one in progress, and every row after it waits.
 */
export function connectionRows(host: ConnectionMachine | null): ConnectionRow[] {
  const installed = host !== null;
  const connected = Boolean(host?.online);

  const stages: Omit<ConnectionRow, 'state'>[] = [
    {
      key: 'installed',
      label: installed ? 'installed' : 'installWaiting',
      detail: host?.runnerVersion ? `v${host.runnerVersion.replace(/^v/, '')}` : null,
    },
    {
      key: 'connected',
      label: 'connected',
      detail: host ? [host.name, host.os].filter(Boolean).join(' · ') : null,
    },
  ];
  const done = [installed, connected];
  const current = done.indexOf(false);

  return stages.map((stage, index) => {
    const state: ConnectionRowState = done[index] ? 'done' : index === current ? 'current' : 'next';
    return { ...stage, state, detail: state === 'done' ? stage.detail : null };
  });
}
