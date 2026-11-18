import type { SessionTerminalWindow } from '@oppenheimer/shared';
import type { SessionWindowListing } from './application/session-windows.port';

/** A session's tmux windows, as the console reads them. */
export class SessionWindowMapper {
  /** One window the runner listed: window 0 is the session's agent, the rest shells or a second agent named after it. */
  static toResponse(window: SessionWindowListing): SessionTerminalWindow {
    const agent = window.index === 0;
    return { index: window.index, name: window.name || (agent ? 'agent' : 'shell'), agent };
  }
}
