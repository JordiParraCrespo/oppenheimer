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
 * Whether a bot's chat draws its tool calls and the routine runs that did
 * nothing else, and the toggle in the chat's bar that shows them. Hidden
 * until the reader shows them. The reader's, so the API never hears of it.
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
