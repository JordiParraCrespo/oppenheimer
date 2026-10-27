import type { SessionFold } from './session-state.policy';
import type { SessionTurnFold } from './session-turn.policy';

/**
 * A follow-up prompt typed into a running session's agent by somebody other
 * than a person at its terminal (issue #493): whether the agent can take one
 * now, and the keys that give it the words the way the console's chat view
 * does.
 */

/**
 * Who sent a prompt, as the API read it when it typed it: the bot whose turn
 * made the call and the turn itself. Recorded on the `prompt.sent` entry, so
 * the log says who spoke whatever the words claim.
 */
export interface SessionPromptSender {
  kind: 'bot';
  botId: string;
  turnId: string;
}

/** Several lines go to the agent as one bracketed paste, so a newline in them is not Enter. */
const PASTE_START = '\u001b[200~';
const PASTE_END = '\u001b[201~';
const ENTER = '\r';

/** How long the agent's prompt takes the text before Enter submits it (the chat view's wait). */
export const PROMPT_SUBMIT_GAP_MS = 60;

/**
 * How long a prompt already sent holds off the next one while the agent has
 * not been seen taking it. A prompt an agent takes without a report (a slash
 * command it answers at once) must not hold the session for ever.
 */
export const PROMPT_SETTLE_SECONDS = 60;

/**
 * Why the agent cannot take a prompt now, or null when it can. Only an open
 * session whose agent was last seen at its prompt (or never reported, as an
 * agent with no screen manifest does) takes one: a starting agent may not be
 * up, a working one would read it mid-task, and a blocked one would take the
 * words as the answer to its question or dialog.
 *
 * A prompt sent moments ago moves neither the state nor what the agent was
 * seen doing, so the turn it opened is the claim: while that follow-up is
 * still queued and the session has been quiet for less than
 * {@link PROMPT_SETTLE_SECONDS}, the next prompt waits, so two sent at once
 * never type into one another. `now` is a parameter so the function stays pure.
 */
export function promptRefusal(
  fold: Pick<SessionFold, 'state' | 'lastObservedState' | 'lastEventAt'>,
  latestTurn: Pick<SessionTurnFold, 'origin' | 'state'> | null,
  now: Date = new Date(),
): string | null {
  if (fold.state !== 'open') return `The session is ${fold.state}, not running.`;
  if (fold.lastObservedState === 'working') {
    return 'The agent is working on a task; wait for it to finish.';
  }
  if (fold.lastObservedState === 'blocked') {
    return 'The agent is waiting on a question or a permission dialog; answer that first.';
  }
  const quietFor = fold.lastEventAt ? (now.getTime() - fold.lastEventAt.getTime()) / 1000 : 0;
  if (
    latestTurn?.origin === 'follow_up' &&
    latestTurn.state === 'queued' &&
    quietFor < PROMPT_SETTLE_SECONDS
  ) {
    return 'Another prompt was just sent and the agent has not taken it yet; wait for it.';
  }
  return null;
}

/** The words, then Enter, each one write: the keys the chat view types for a message. */
export function promptKeys(text: string): string[] {
  const words = text.includes('\n') ? `${PASTE_START}${text}${PASTE_END}` : text;
  return [words, ENTER];
}
