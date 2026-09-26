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

/** Bytes to whole gigabytes, as a machine's memory is spoken of. */
export function gigabytesOf(bytes: number | null): number | null {
  if (!bytes || bytes <= 0) return null;
  return Math.round(bytes / 1024 ** 3);
}

/**
 * The meta line's facts, in the order the frame reads them — "Ubuntu 24.04 ·
 * 32 vCPU · 64 GB · Madrid, ES · runner 0.14.2" — each one present only when
 * the runner or the IP database knew it. `kind` says how to word it.
 */
export type MetaPart =
  | { kind: 'text'; value: string }
  | { kind: 'cpus'; count: number }
  | { kind: 'memory'; gb: number }
  | { kind: 'runner'; version: string };

export function metaPartsOf(host: HostEntity): MetaPart[] {
  const { details } = host;
  const parts: MetaPart[] = [];
  const os = details.osName ?? host.os;
  if (os) parts.push({ kind: 'text', value: os });
  if (details.cpuCount) parts.push({ kind: 'cpus', count: details.cpuCount });
  const gb = gigabytesOf(details.memoryTotalBytes);
  if (gb) parts.push({ kind: 'memory', gb });
  const place = [details.city, details.countryCode].filter(Boolean).join(', ');
  if (place) parts.push({ kind: 'text', value: place });
  if (host.runnerVersion) parts.push({ kind: 'runner', version: host.runnerVersion });
  return parts;
}
