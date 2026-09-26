import type { HostCardStatus } from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';

/**
 * How a host reads on its Settings card, as data: the card's dot, and the
 * pieces of its meta line. Words are the screen's to translate; this decides
 * only which facts appear and in what order.
 */

/** The card draws three dots; a removed host is not on the list, and reads as offline if it is. */
export function cardStatusOf(host: HostEntity): HostCardStatus {
  const { status } = host.details;
  return status === 'running' || status === 'idle' ? status : 'offline';
}

/**
 * The meta line's facts, in the order the frame reads them — "Ubuntu 24.04 ·
 * 32 vCPU · eu-west · runner 0.14.2" — each one present only when the runner
 * reported it. The frame's third fact (a region, or "local") has no source
 * yet, so it is left out rather than guessed. `kind` says how to word it.
 */
export type MetaPart =
  | { kind: 'text'; value: string }
  | { kind: 'cpus'; count: number }
  | { kind: 'runner'; version: string };

export function metaPartsOf(host: HostEntity): MetaPart[] {
  const { details } = host;
  const parts: MetaPart[] = [];
  const os = details.osName ?? host.os;
  if (os) parts.push({ kind: 'text', value: os });
  if (details.cpuCount) parts.push({ kind: 'cpus', count: details.cpuCount });
  if (host.runnerVersion) parts.push({ kind: 'runner', version: host.runnerVersion });
  return parts;
}
