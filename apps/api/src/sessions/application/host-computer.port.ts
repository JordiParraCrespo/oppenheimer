import type { ComputerActMessage, ComputerScreenMessage } from '@oppenheimer/shared/protocol';

/** What to do on a host's screen: `computer.act` without its envelope. */
export type HostComputerRequest = Omit<ComputerActMessage, 'type' | 'commandId'>;

/** What the screen showed afterwards: `computer.screen` without its envelope. */
export type HostComputerScreen = Omit<ComputerScreenMessage, 'type' | 'commandId'>;

/**
 * What asking a host to act on its screen came back with: the screen, the
 * reason nothing was asked (no link, or a runner that drives no screen), no
 * answer in time, or the host's refusal with its catalog code (`COMPUTER_001`
 * it is off there, `COMPUTER_002` the host has no screen it can use,
 * `COMPUTER_003` the action does not fit, `COMPUTER_004` the screen could not
 * be read or used, `COMPUTER_005` its setting cannot be read).
 */
export type HostComputerOutcome =
  | { kind: 'screen'; screen: HostComputerScreen }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string; detail?: string };

/**
 * What the module that owns the runner link implements so a bot can use a
 * host's screen, mouse and keyboard (`product/versions/mvp/25-bots.md` §4.2,
 * "Using a computer"). It waits for the runner's answer; whether the host
 * lets a bot near its screen at all is the host's own setting, which nothing
 * here sees. The screenshot is never stored.
 */
export interface HostComputerPort {
  /**
   * Do `request` on the host. `commandId`, when given, names the action
   * across retries: a runner that already did it answers with the screen it
   * left instead of doing it again. Absent, every call is a new action.
   */
  act(
    hostId: string,
    request: HostComputerRequest,
    commandId?: string,
  ): Promise<HostComputerOutcome>;
}
