import type { HostSettingsMessage, HostSettingsSetMessage } from '@oppenheimer/shared/protocol';

/** What to change on a host: `host.settings.set` without its envelope. */
export type HostSettingsChange = Omit<HostSettingsSetMessage, 'type' | 'commandId'>;

/** What the host lets bots do after it: `host.settings` without its envelope. */
export type HostSettings = Omit<HostSettingsMessage, 'type' | 'commandId'>;

/**
 * What changing a host's switches came back with: what the host now allows,
 * the reason nothing was asked (no link, or a runner too old to take it), no
 * answer in time, or the host's refusal with its catalog code (`EXEC_008` an
 * allowlist entry is not a program, `*_005` a file could not be written).
 */
export type HostSettingsOutcome =
  | { kind: 'set'; settings: HostSettings }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string; detail?: string };

/**
 * What the module that owns the runner link implements so a bot can change
 * what a host lets bots do (its browser, its screen, what it runs), when the
 * person asked it to: the files `runner browser`, `runner computer` and
 * `runner exec` write on the host.
 */
export interface HostSettingsPort {
  set(hostId: string, change: HostSettingsChange): Promise<HostSettingsOutcome>;
}
