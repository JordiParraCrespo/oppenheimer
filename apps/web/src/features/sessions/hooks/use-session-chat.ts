import { type ChatState, SessionChat } from '@oppenheimer/frontend-consumer';
import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { useState, useSyncExternalStore } from 'react';
import type { PaneReading } from '../lib/chat-blocks';

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
function useChatAvailable(chat: SessionChat): boolean {
  const available = () => chat.snapshot().available;
  return useSyncExternalStore(chat.subscribe, available, available);
}

/**
 * What a terminal does with the pane's reading: whether it offers Terminal /
 * Chat (the host sends the transcript and `session_chat_view` is on) and
 * whether the chat is the view on screen. One decision for every terminal
 * that hosts a chat, a member's and a guest's.
 */
export function useChatReading(reading: PaneReading): { offered: boolean; shown: boolean } {
  const available = useChatAvailable(reading.chat);
  const flag = useFeatureFlag('session_chat_view');
  const offered = available && flag;
  return { offered, shown: offered && reading.view === 'chat' };
}
