import { type ChatState, SessionChat } from '@oppenheimer/frontend-consumer';
import { useState, useSyncExternalStore } from 'react';

/**
 * One terminal pane's chat view (0.7): the store the pane's stream feeds
 * (`useTerminal`'s `onChat`), made once for the pane's life. The pane holds
 * it without reading it, so a batch re-renders only what subscribes below.
 */
export function useSessionChat(): SessionChat {
  const [chat] = useState(() => new SessionChat());
  return chat;
}

/** The chat as it stands, for the view that draws it; external store: `SessionChat`. */
export function useChatState(chat: SessionChat): ChatState {
  return useSyncExternalStore(chat.subscribe, chat.snapshot, chat.snapshot);
}

/** Whether the host sends this session's chat at all, for the toggle that offers it. */
export function useChatAvailable(chat: SessionChat): boolean {
  const available = () => chat.snapshot().available;
  return useSyncExternalStore(chat.subscribe, available, available);
}
