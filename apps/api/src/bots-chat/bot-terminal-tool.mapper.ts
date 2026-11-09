import { createHash } from 'node:crypto';
import type { TERMINAL_KEYS } from '@oppenheimer/shared/protocol';
import type { TerminalDriveRequest } from '../sessions/application/session-terminal.port';

/** How long a drive waits when the call names no wait, in seconds. */
export const DEFAULT_TERMINAL_WAIT_SECONDS = 2;

/** A terminal tool's input, as the bot writes it (snake_case). */
export interface TerminalToolInput {
  text?: string;
  keys?: (typeof TERMINAL_KEYS)[number][];
  wait_for?: string;
  wait_seconds?: number;
  history?: number;
}

/**
 * A terminal tool's input as `terminal.drive` takes it: the fields the bot
 * left out are left out, empty text and an empty key list send nothing, and
 * the wait defaults.
 */
export function toTerminalDriveRequest(input: TerminalToolInput): TerminalDriveRequest {
  return {
    ...(input.text ? { text: input.text } : {}),
    ...(input.keys?.length ? { keys: input.keys } : {}),
    ...(input.wait_for ? { waitFor: input.wait_for } : {}),
    waitSeconds: input.wait_seconds ?? DEFAULT_TERMINAL_WAIT_SECONDS,
    ...(input.history ? { history: input.history } : {}),
  };
}

/**
 * The `terminal.drive` command id of an approved call: the same for every
 * retry of that approval's job, so a worker that crashed after the host
 * typed gets that screen back instead of typing it a second time.
 */
export function terminalCommandIdOf(approvalId: string): string {
  const hex = createHash('sha256').update(`terminal.drive:${approvalId}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
