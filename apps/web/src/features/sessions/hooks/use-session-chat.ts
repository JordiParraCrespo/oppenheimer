import type { ChatState, ChatTurn, SessionChat } from '@oppenheimer/frontend-consumer';
import { shareEntities, useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { PaneReading } from '../lib/chat-blocks';
import { sessionChatFor } from '../lib/session-chats';

/**
 * One terminal pane's chat view (0.7): the store the pane's stream feeds
 * (`useTerminal`'s `onChat`), the one this tab keeps for the session under
 * `key` (`session-chats.ts`), so a pane mounted again draws what it held.
 * The pane holds it without reading it, so a batch re-renders only what
 * subscribes below.
 */
export function useSessionChat(key: string): SessionChat {
  const [chat] = useState(() => sessionChatFor(key));
  // Effect: the kept chat outlives this pane, so the pane hands it back on
  // unmount (`SessionChat.detach`). React runs this cleanup just before its
  // terminal's, in the same commit; the stream feeds the chat only from its
  // socket's messages, so nothing reaches it between the two.
  useEffect(() => () => chat.detach(), [chat]);
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
        shared &&
        turns === shared.turns &&
        next.available === shared.available &&
        next.queued === shared.queued &&
        next.status === shared.status &&
        next.older === shared.older &&
        next.interruptible === shared.interruptible
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

/** The turns of one shared snapshot by id, built once per snapshot for every turn that looks itself up. */
const turnsById = new WeakMap<readonly ChatTurn[], Map<string, ChatTurn>>();

function turnOf(turns: readonly ChatTurn[], id: string): ChatTurn | undefined {
  let byId = turnsById.get(turns);
  if (!byId) {
    byId = new Map(turns.map((turn) => [turn.id, turn]));
    turnsById.set(turns, byId);
  }
  return byId.get(id);
}

/**
 * One turn of the chat, for the component that draws it: the same object
 * until that turn changes, so a line the agent writes redraws the turn it
 * landed in and no other. None once a reset has taken it away.
 */
export function useChatTurn(chat: SessionChat, id: string): ChatTurn | undefined {
  const read = sharedRead(chat);
  const select = () => turnOf(read().turns, id);
  return useSyncExternalStore(chat.subscribe, select, select);
}

/** Each chat's turn ids, kept so they change only when a turn is added or taken away. */
const sharedIds = new WeakMap<SessionChat, () => readonly string[]>();

/**
 * The chat's turn ids, in order, for the list that lays the turns out: the
 * same array until a turn opens or a reset takes some away, so the list does
 * not redraw on every line the agent writes into a turn it already has.
 */
export function useChatTurnIds(chat: SessionChat): readonly string[] {
  let select = sharedIds.get(chat);
  if (!select) {
    const read = sharedRead(chat);
    let from: readonly ChatTurn[] | null = null;
    let ids: readonly string[] = [];
    select = () => {
      const { turns } = read();
      if (turns === from) return ids;
      from = turns;
      const next = turns.map((turn) => turn.id);
      if (next.length !== ids.length || next.some((id, index) => id !== ids[index])) ids = next;
      return ids;
    };
    sharedIds.set(chat, select);
  }
  return useSyncExternalStore(chat.subscribe, select, select);
}

/** Whether the host holds turns before the first one the chat holds, and whether a page of them is coming. */
export function useChatOlder(chat: SessionChat): ChatState['older'] {
  const older = () => chat.snapshot().older;
  return useSyncExternalStore(chat.subscribe, older, older);
}

/** Whether a first load's history is still arriving, for the chat to wait for it. */
export function useChatLoading(chat: SessionChat): boolean {
  const loading = () => chat.snapshot().loading;
  return useSyncExternalStore(chat.subscribe, loading, loading);
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

/** What the agent's spinner says this moment, for the line at the chat's foot; external store: `SessionChat`. */
export function useChatActivity(chat: SessionChat): ChatState['activity'] {
  const activity = () => chat.snapshot().activity;
  return useSyncExternalStore(chat.subscribe, activity, activity);
}
