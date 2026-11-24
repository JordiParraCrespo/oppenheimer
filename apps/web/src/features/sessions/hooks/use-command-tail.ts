import type { SessionChat } from '@oppenheimer/frontend-consumer';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { tailLinesOf } from '../lib/chat-blocks';

/**
 * The chat whose terminal reads a running command's output off the screen,
 * for the row of that command, deep in a turn, to subscribe to on its own.
 * None where no terminal is under the chat (a cloud session's).
 */
export const CommandTailContext = createContext<SessionChat | null>(null);

const NO_CHAT = () => () => {};
/** Lines kept apart in the one string a snapshot compares by value. */
const SEPARATOR = '\n';

/**
 * The last lines a running command printed, as the agent's screen shows
 * them (`ChatActivity.tail`), for the call whose command it is; none when
 * the screen shows another command's or none. External store: the
 * `SessionChat`. Read as one string, so the clock beside the spinner, which
 * moves every second, redraws nothing here while the lines stand.
 */
export function useCommandTail(command: string | null): readonly string[] | null {
  const chat = useContext(CommandTailContext);
  const read = () => {
    const lines = chat ? tailLinesOf(chat.snapshot().activity?.tail, command) : null;
    return lines ? lines.join(SEPARATOR) : null;
  };
  const text = useSyncExternalStore(chat?.subscribe ?? NO_CHAT, read, read);
  return text === null ? null : text === '' ? [] : text.split(SEPARATOR);
}
