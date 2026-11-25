import { useSyncExternalStore } from 'react';
import type { TerminalScreen, TerminalSnapshot } from '../lib/terminal-screen';

/**
 * What the terminal shows now; external store: the session's `TerminalScreen`,
 * which publishes once per parsed write.
 */
export function useTerminalSnapshot(screen: TerminalScreen): TerminalSnapshot {
  return useSyncExternalStore(screen.subscribe, screen.snapshot, screen.snapshot);
}
