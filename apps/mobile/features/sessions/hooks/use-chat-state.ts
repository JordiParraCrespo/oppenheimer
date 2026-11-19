import type { ChatState, SessionChat } from '@oppenheimer/frontend-consumer';
import { useSyncExternalStore } from 'react';

/** The chat as it stands; external store: the session's `SessionChat`. */
export function useChatState(chat: SessionChat): ChatState {
  return useSyncExternalStore(chat.subscribe, chat.snapshot, chat.snapshot);
}
