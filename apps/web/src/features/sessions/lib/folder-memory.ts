/**
 * The last folder New session used on each host, and that host's home, so a
 * folder session opens where the last one did and the chip can say `~/…`
 * before the host has been asked anything. Per host, because a path on one
 * machine means nothing on another. A convenience: unreadable storage is an
 * empty memory.
 */
const STORAGE_KEY = 'oppenheimer.new-session.folders';

export interface RememberedFolder {
  /** Absolute, on the host. */
  path: string;
  /** The host's home directory as its runner last reported it. */
  home: string | null;
}

export function rememberedFolder(hostId: string): RememberedFolder | null {
  const entry = read()[hostId];
  if (typeof entry !== 'object' || entry === null) return null;
  const { path, home } = entry as Partial<RememberedFolder>;
  if (typeof path !== 'string' || !path.startsWith('/')) return null;
  return { path, home: typeof home === 'string' ? home : null };
}

export function rememberFolder(hostId: string, folder: RememberedFolder) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...read(), [hostId]: folder }));
  } catch {
    // Private browsing, a full quota, storage switched off: nothing is lost
    // but the next visit's starting point.
  }
}

function read(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
