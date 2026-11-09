import type { TerminalDriveMessage, TerminalScreenMessage } from '@oppenheimer/shared/protocol';

/** What to type and how to wait: `terminal.drive` without its envelope and session. */
export type TerminalDriveRequest = Omit<TerminalDriveMessage, 'type' | 'commandId' | 'sessionId'>;

/** The screen the drive left: `terminal.screen` without its envelope. */
export type TerminalScreen = Omit<TerminalScreenMessage, 'type' | 'commandId'>;

/**
 * What driving a blank-terminal session came back with: the screen, the
 * reason nothing was asked (no link, or a runner that drives no terminals),
 * no answer in time, or the host's refusal with its code (`EXEC_006` its exec
 * policy is not `full`, `EXEC_007` the session is not a blank terminal,
 * `SESS_001`, `SESS_003`, `INVALID_PATTERN`).
 */
export type SessionTerminalOutcome =
  | { kind: 'screen'; screen: TerminalScreen }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string; detail?: string };

/**
 * What the module that owns the runner link implements so a bot can type
 * into a blank terminal and read its screen (`product/versions/mvp/25-bots.md`
 * §4.2, "Driving a terminal"). It waits for the runner's answer, for as long
 * as the drive's own wait; the screen is never stored.
 */
export interface SessionTerminalPort {
  /**
   * Drive the terminal. `commandId`, when given, names the drive across
   * retries of one approved call: a runner that already drove it answers with
   * the screen it left instead of typing again. Absent, every call is new.
   */
  drive(
    hostId: string,
    sessionId: string,
    request: TerminalDriveRequest,
    commandId?: string,
  ): Promise<SessionTerminalOutcome>;
}
