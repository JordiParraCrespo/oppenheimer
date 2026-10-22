import { type ChatState, SessionChat } from '@oppenheimer/frontend-consumer';
import { shareEntities } from '@oppenheimer/frontend-core/react';
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

/** Each chat's reading, kept so every batch is shared against the last one drawn. */
const sharedReads = new WeakMap<SessionChat, () => ChatState>();

/**
 * The chat's snapshot with what a batch left unchanged kept by identity. The
 * store rebuilds every turn from the whole transcript on each batch, so
 * without this every `ChatTurn`, and every block under it, would redraw on
 * each line the agent writes rather than only the turn that moved.
 */
function sharedRead(chat: SessionChat): () => ChatState {
  let read = sharedReads.get(chat);
  if (read) return read;
  let raw: ChatState | null = null;
  let shared: ChatState | null = null;
  read = () => {
    const next = chat.snapshot();
    if (next !== raw) {
      raw = next;
      // The list, not the state: an array is rebuilt from its shared items,
      // a record that changed is taken whole.
      const turns = shareEntities(shared?.turns, next.turns);
      shared =
        shared && turns === shared.turns && next.available === shared.available
          ? shared
          : { ...next, turns };
    }
    return shared ?? next;
  };
  sharedReads.set(chat, read);
  return read;
}

/** The chat as it stands, for the view that draws it; external store: `SessionChat`. */
export function useChatState(chat: SessionChat): ChatState {
  const read = sharedRead(chat);
  return useSyncExternalStore(chat.subscribe, read, read);
}

/** Whether the host sends this session's chat at all, for the toggle that offers it. */
export function useChatAvailable(chat: SessionChat): boolean {
  const available = () => chat.snapshot().available;
  return useSyncExternalStore(chat.subscribe, available, available);
}
