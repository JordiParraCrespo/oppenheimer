import { useStoredFold } from '@oppenheimer/frontend-web';
import { createContext, useContext } from 'react';

/**
 * Where the reader's choice to show tool calls is kept on this device, for
 * every bot's chat. The list holds the id once they are shown, so a reader
 * who never pressed the wrench reads the quiet chat.
 */
const TOOL_CALLS_KEY = 'oppenheimer.bots.toolCallsShown';
const TOOL_CALLS_ID = 'chat';

/**
 * Which of a bot chat's two views the reader is on. Hidden (the default) is
 * the quiet chat, read like a messenger: the messages, the day, and that the
 * bot is thinking. Shown adds the work: each tool call, the routine runs that
 * did nothing else, a followed project's task updates, what the running call
 * is doing with its clock and subagents, a model switch, and each turn's
 * time, model and tokens. The wrench in the chat's bar switches them. The
 * reader's, so the API never hears of it.
 */
export function useToolCallsShown() {
  const { open, setOpen } = useStoredFold(TOOL_CALLS_KEY, TOOL_CALLS_ID);
  return { shown: !open, setShown: (shown: boolean) => setOpen(!shown) };
}

/** The chat's choice, for the trace deep in each turn; shown when no chat provides it. */
export const ToolCallsShownContext = createContext(true);

export function useToolCallsShownInChat() {
  return useContext(ToolCallsShownContext);
}
