import { SessionChat } from '@oppenheimer/frontend-consumer';

/**
 * Each session's chat this tab has read, kept so coming back to a session
 * draws its conversation at once instead of waiting on the host's history.
 *
 * The pane is keyed by the session, so moving between sessions mounts it
 * afresh, and the host sends the whole transcript again on every attach. A
 * chat kept here already holds it: the history that comes again is checked
 * against what is held and publishes nothing where it matches
 * (`SessionChat.apply`), so the conversation stays drawn while it arrives.
 *
 * Memory only, and bounded like the terminal's pictures
 * (`terminal-snapshots.ts`): a long conversation is megabytes of lines, so
 * the most recent `LIMIT` are kept, and a reload starts empty.
 */
const LIMIT = 5;

const chats = new Map<string, SessionChat>();

/** The chat kept under `key`, or a new one kept from now on. */
export function sessionChatFor(key: string): SessionChat {
  const chat = chats.get(key) ?? new SessionChat();
  // Re-inserted so the Map's order is least to most recently read.
  chats.delete(key);
  chats.set(key, chat);
  while (chats.size > LIMIT) {
    const oldest = chats.keys().next().value;
    if (oldest === undefined) break;
    chats.delete(oldest);
  }
  return chat;
}
