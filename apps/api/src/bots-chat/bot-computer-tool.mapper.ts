import type { HostComputerRequest } from '../sessions/application/host-computer.port';
import { type ComputerCall, computerCallFields } from './application/bot-computer.policy';

/** A `use_computer` field as the link's `computer.act` names it. */
const ON_THE_LINK = {
  x: 'x',
  y: 'y',
  to_x: 'toX',
  to_y: 'toY',
  scroll_x: 'scrollX',
  scroll_y: 'scrollY',
  text: 'text',
  keys: 'keys',
  seconds: 'seconds',
} as const satisfies Record<keyof Omit<ComputerCall, 'action'>, keyof HostComputerRequest>;

/**
 * A `use_computer` call as the host is asked it: the action and only the
 * fields that action takes (`COMPUTER_ACTION_SPECS`), under the link's
 * names. A field the model sent beside an action that has no use for it (an
 * `x` with `type`) stays behind.
 */
export function toHostComputerRequest(call: ComputerCall): HostComputerRequest {
  const request: Record<string, unknown> = { action: call.action };
  for (const field of computerCallFields(call)) {
    if (call[field] !== undefined) request[ON_THE_LINK[field]] = call[field];
  }
  return request as HostComputerRequest;
}
