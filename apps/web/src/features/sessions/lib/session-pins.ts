import type { SessionEntity } from '@oppenheimer/frontend-consumer';

/**
 * The sessions the reader pinned to the top of the sidebar, kept on this
 * device the way the sidebar's order is (`sidebar-order.ts`): their ids,
 * the most recently pinned first. A pin is the reader's, not the session's,
 * so the API never hears of it.
 */
export const SESSION_PINS_KEY = 'oppenheimer.sidebar.pins';

/** Anything unreadable, or storage switched off, is no pin. */
export function storedSessionPins(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(SESSION_PINS_KEY) ?? 'null');
    return Array.isArray(stored)
      ? [...new Set(stored.filter((id): id is string => typeof id === 'string'))]
      : [];
  } catch {
    return [];
  }
}

export function rememberSessionPins(pins: readonly string[]) {
  try {
    window.localStorage.setItem(SESSION_PINS_KEY, JSON.stringify(pins));
  } catch {
    // Private browsing or a full quota: the pins hold until the page reloads.
  }
}

/** `pins` with `id` pinned on top, or taken out. */
export function withPin(pins: readonly string[], id: string, pinned: boolean): string[] {
  const rest = pins.filter((pinnedId) => pinnedId !== id);
  return pinned ? [id, ...rest] : rest;
}

/**
 * The pinned sessions, in pin order, and the rest as they came. A pin whose
 * session is not in `sessions` (filtered out, or deleted) draws nothing.
 */
export function splitPinned(
  sessions: readonly SessionEntity[],
  pins: readonly string[],
): { pinned: SessionEntity[]; rest: SessionEntity[] } {
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const pinned = pins.flatMap((id) => byId.get(id) ?? []);
  const set = new Set(pins);
  return { pinned, rest: sessions.filter((session) => !set.has(session.id)) };
}
