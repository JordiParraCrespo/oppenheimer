/**
 * Where a desktop stands, as the viewer draws it. `unavailable` and `ended`
 * are final; the rest dial again on their own.
 */
export type DesktopViewStatus =
  | 'connecting'
  | 'live'
  | 'offline'
  | 'unavailable'
  | 'ended'
  | 'dropped';

export interface DesktopViewState {
  status: DesktopViewStatus;
  /** Whether the reader's clicks and keys reach the desktop. */
  control: boolean;
  /** Why the host refused it: a runner catalog code (`DESKTOP_001`…) and its detail. */
  refusal: { code: string; detail?: string } | null;
}

/**
 * Where the host's pointer is, in the host's own screen units on a screen
 * `width` by `height` of them. The viewer scales it onto the framebuffer.
 */
export interface DesktopPointer {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One dial to a desktop, as the product package opens it: a channel of a
 * WebSocket's shape that noVNC attaches to, plus what only the console asks
 * of it. The viewer never names a host; the product package's factory did.
 */
export interface DesktopChannel {
  readonly readyState: string;
  onState(listener: (state: DesktopViewState) => void): () => void;
  /** Where the host's pointer is, while the reader watches; the host may never say. */
  onPointer(listener: (pointer: DesktopPointer) => void): () => void;
  setControl(control: boolean): void;
  close(): void;
}

/** Statuses after which no new dial can help. */
export function isFinalDesktopStatus(status: DesktopViewStatus): boolean {
  return status === 'unavailable' || status === 'ended';
}

/** How long to wait before dialling again after `attempt` failed dials. */
export function desktopRetryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 15_000);
}
