import {
  type ChatSync,
  type ClaimedReply,
  claimReplies,
  confirmReply,
  fetchSessionEvents,
  forwardEvents,
  postReply,
  releaseReply,
  sessionsToSync,
} from './chat';
import { clearChatProblem, readState, writeState } from './store';

/** How long a session a reply was posted to is read at every turn of the loop. */
const HOT_MS = 3 * 60_000;
/** How long the loop waits for a reply while a session is running, and while none is. */
const BUSY_WAIT_SECONDS = 3;
const IDLE_WAIT_SECONDS = 10;
/** Sessions whose log one pass reads, at most. */
const SESSIONS_PER_PASS = 10;
/** A failed claim waits this long before the next one. */
const RETRY_MS = 15_000;

/** What the bridge needs from the worker. */
export interface ChatBridgeDeps {
  /** The headers claude.ai's app asks with. */
  claudeHeaders(): Promise<Record<string, string>>;
  /** The worker's one queue for read-change-write of storage. */
  serial<T>(task: () => Promise<T>): Promise<T>;
}

/** The bridge the worker starts. */
export interface ChatBridge {
  /** Starts the loop unless it runs already; it ends when Oppenheimer is disconnected. */
  run(): void;
  /** One pass over the sessions that are moving, outside the loop. */
  syncPass(): Promise<void>;
}

/**
 * The chat bridge between claude.ai and the person's Oppenheimer: a loop,
 * while Oppenheimer is connected, that claims the replies typed in the
 * console and posts them on claude.ai, then carries the logs of the sessions
 * that are moving to the console. It owns what the loop keeps: the sessions
 * just replied to, the pass's cap and order, and where each log has got to
 * (`chatSync`). One loop at a time; each request it has open keeps the worker
 * alive. What it does to a request is `chat.ts`.
 */
export function createChatBridge({ claudeHeaders, serial }: ChatBridgeDeps): ChatBridge {
  /** Sessions a reply was just posted to, and when. Lost with the worker, which is fine. */
  const hot = new Map<string, number>();
  let running = false;

  function run() {
    if (running) return;
    running = true;
    void chatLoop().finally(() => {
      running = false;
    });
  }

  async function chatLoop() {
    for (;;) {
      const { oppenheimer, sessions } = await readState();
      if (!oppenheimer) return;
      const busy = Object.values(sessions).some((session) => session.state === 'running');
      let replies: ClaimedReply[] = [];
      try {
        replies = await claimReplies(
          oppenheimer,
          busy || hot.size > 0 ? BUSY_WAIT_SECONDS : IDLE_WAIT_SECONDS,
        );
      } catch (error) {
        await writeState({
          chatProblem: { at: now(), detail: String((error as Error).message ?? error) },
        });
        await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
        continue;
      }
      if (replies.length > 0) {
        const headers = await claudeHeaders();
        for (const reply of replies) {
          const posted = await postReply(reply, headers);
          if (posted.ok) {
            hot.set(reply.cloudSessionId, Date.now());
            // A confirmation that does not arrive lets the claim lapse, and the
            // reply goes again: claude.ai keeps one message per id.
            await confirmReply(oppenheimer, reply.id).catch(() => {});
          } else {
            // One not handed back lapses on its own within a minute.
            await releaseReply(oppenheimer, reply.id, posted.reason).catch(() => {});
          }
        }
      }
      await serial(syncPass);
    }
  }

  /**
   * One pass over the sessions that are moving: reads each one's log from
   * claude.ai and sends the console what it does not have yet. A session the
   * console has not seen is adopted there by the first batch.
   */
  async function syncPass() {
    const state = await readState();
    if (!state.oppenheimer) return;
    const clock = Date.now();
    for (const [id, at] of hot) if (clock - at > HOT_MS) hot.delete(id);
    const synced: Record<string, ChatSync> = { ...state.chatSync };
    const due = sessionsToSync(Object.values(state.sessions), synced, new Set(hot.keys()), clock);
    if (due.length === 0) return;
    const headers = await claudeHeaders();
    let problem: string | null = null;
    // One session's failure (a refused batch, a log claude.ai will not give)
    // is said, and the others in the pass still go.
    for (const session of due.slice(0, SESSIONS_PER_PASS)) {
      const known = synced[session.id];
      try {
        const read = await fetchSessionEvents(
          session.id,
          headers,
          state.eventsEndpoint ?? null,
          known?.resume ?? null,
        );
        if (!read) {
          // A place to carry on from that no longer answers is dropped: the
          // next read starts from the first page.
          synced[session.id] = { sent: known?.sent ?? 0, at: known?.at ?? '', readAt: now() };
          continue;
        }
        const held = await forwardEvents(
          state.oppenheimer,
          session,
          read.events,
          Math.max(0, (known?.sent ?? 0) - read.offset),
        );
        synced[session.id] = {
          sent: read.offset + held,
          // Up to date only once read to the end; a read cut short is due again.
          at: read.complete ? (session.updatedAt ?? now()) : (known?.at ?? ''),
          resume: read.resume,
          readAt: now(),
        };
      } catch (error) {
        synced[session.id] = {
          ...known,
          sent: known?.sent ?? 0,
          at: known?.at ?? '',
          readAt: now(),
        };
        problem ??= `${session.id}: ${String((error as Error).message ?? error)}`;
      }
    }
    // Only the sessions still tracked keep a place, so the record stays small.
    const kept = Object.fromEntries(Object.entries(synced).filter(([id]) => id in state.sessions));
    await writeState({ chatSync: kept });
    if (problem) await writeState({ chatProblem: { at: now(), detail: problem } });
    else await clearChatProblem();
  }

  return { run, syncPass };
}

function now() {
  return new Date().toISOString();
}
