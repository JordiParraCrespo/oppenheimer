import type { SessionChat } from '@oppenheimer/frontend-consumer';
import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { useSyncExternalStore } from 'react';

/**
 * Whether the session offers its chat, as the console decides it: the host
 * sends this session's transcript (a first batch has come; a shell, or an
 * agent the runner reads no transcript of, never sends one) and
 * `session_chat_view` is on. External store: the session's `SessionChat`,
 * read down to the one boolean so a batch does not redraw the pane.
 */
export function useChatOffered(chat: SessionChat): boolean {
  const available = () => chat.snapshot().available;
  const sent = useSyncExternalStore(chat.subscribe, available, available);
  const flag = useFeatureFlag('session_chat_view');
  return sent && flag;
}
