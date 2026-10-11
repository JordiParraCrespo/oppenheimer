/**
 * The last picture of each terminal this tab has shown, kept so switching
 * back to a session paints it at once instead of the waiting state.
 *
 * A snapshot is what `@xterm/addon-serialize` wrote when the pane unmounted:
 * escape sequences that redraw the screen and its scrollback. It is only a
 * stand-in. The runner's attach redraws the real screen, and the pane resets
 * to that on the first bytes it sends (`mountSessionTerminal`), so a stale
 * picture lasts as long as the dial and no longer.
 *
 * Memory only, and bounded: a tab that walks through many sessions keeps the
 * most recent `LIMIT`, and a reload starts empty.
 */
const LIMIT = 20;

const snapshots = new Map<string, string>();

export function readTerminalSnapshot(key: string): string | undefined {
  return snapshots.get(key);
}

export function keepTerminalSnapshot(key: string, snapshot: string) {
  // Re-inserted so the Map's order is least to most recently kept.
  snapshots.delete(key);
  if (!snapshot) return;
  snapshots.set(key, snapshot);
  while (snapshots.size > LIMIT) {
    const oldest = snapshots.keys().next().value;
    if (oldest === undefined) break;
    snapshots.delete(oldest);
  }
}
