import type { HostExecMessage, HostExecResultMessage } from '@oppenheimer/shared/protocol';

/** What to run on a host: `host.exec` without its envelope. */
export type HostExecRequest = Omit<HostExecMessage, 'type' | 'commandId'>;

/** How a run ended, as the runner reported it: `host.exec.result` without its envelope. */
export type HostExecRun = Omit<HostExecResultMessage, 'type' | 'commandId'>;

/**
 * What asking a host to run a program came back with: how the run ended, the
 * reason nothing was asked (no link, or a runner that runs nothing for bots),
 * no answer in time, or the host's refusal with its catalog code (`EXEC_001`
 * exec is off there, `EXEC_002` the program is not allowed, `EXEC_003` the
 * folder is not usable, `EXEC_004` the program could not be started).
 */
export type HostExecOutcome =
  | { kind: 'ran'; run: HostExecRun }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string; detail?: string };

/**
 * What the module that owns the runner link implements so a bot can run a
 * program on a host (`product/versions/mvp/25-bots.md` §4.2, "Commands on a
 * host"). Like `HostFoldersPort` it waits for the runner's answer, for as long
 * as the run may take; whether the program may run at all is the host's own
 * policy, which nothing here sees.
 */
export interface HostExecPort {
  /**
   * Run `request` on the host. `commandId`, when given, names the run across
   * retries: a runner that already ran it answers with that run's result
   * instead of running it again. Absent, every call is a new run.
   */
  run(hostId: string, request: HostExecRequest, commandId?: string): Promise<HostExecOutcome>;
}
