import { SessionTerminal } from '../sections/session-terminal';

/**
 * One session: the terminal, and nothing else.
 *
 * The artboard gives this screen no page head and no window strip — the
 * sidebar names the session and is how you leave it, and the terminal takes
 * the whole pane. It fills the shell's content column, which is a flex column
 * for exactly this screen's sake.
 */
export function SessionScreen() {
  return <SessionTerminal />;
}
