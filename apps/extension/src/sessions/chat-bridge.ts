import { BROWSER_REPLY_LEASE_SECONDS } from '@oppenheimer/shared/schemas/session-cloud-chat';
import {
  CHAT_COPY_VERSION,
  type ChatSync,
  type ClaimedReply,
  type ClaudePost,
  claimReplies,
  confirmReply,
  current,
  fetchSessionEvents,
  forwardEvents,
  forwardNewestFirst,
  POST_TIMEOUT_MS,
  postReply,
  releaseReply,
  sessionsToSync,
} from './chat';
import { clearChatProblem, type OppenheimerConnection, readState, writeState } from './store';

/** How long a session a reply was posted to is read at every turn of the loop. */
const HOT_MS = 3 * 60_000;
/** How long the loop waits for a reply while a session is running, and while none is. */
const BUSY_WAIT_SECONDS = 3;
const IDLE_WAIT_SECONDS = 10;
/** Sessions whose log one pass reads, at most. */
const SESSIONS_PER_PASS = 10;
/**
 * How long after its claim a reply may still be posted: the start of a post,
 * plus its two attempts (`POST_TIMEOUT_MS` each), ends inside the claim's lease.
 */
const POST_START_WITHIN_MS = BROWSER_REPLY_LEASE_SECONDS * 1000 - 2 * POST_TIMEOUT_MS - 6_000;
/** How long a delivery claude.ai took is confirmed again, at most. */
const CONFIRM_FOR_MS = 10 * 60_000;
/** A failed claim waits this long before the next one. */
const RETRY_MS = 15_000;

/** What the bridge needs from the worker. */
export interface ChatBridgeDeps {
  /** The headers claude.ai's app asks with. */
  claudeHeaders(): Promise<Record<string, string>>;
  /** The worker's one queue for read-change-write of storage. */
  serial<T>(task: () => Promise<T>): Promise<T>;
  /** How a reply's post reaches claude.ai: from one of its own tabs. */
  postToClaude: ClaudePost;
}

/** The bridge the worker starts. */
export interface ChatBridge {
  /** Starts the loop unless it runs already; it ends when Oppenheimer is disconnected. */
  run(): void;
  /** One pass over the sessions that are moving, outside the loop: why one could not be carried, or null. */
  syncPass(): Promise<string | null>;
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
export function createChatBridge({
  claudeHeaders,
  serial,
  postToClaude,
}: ChatBridgeDeps): ChatBridge {
  /** Sessions a reply was just posted to, and when. Lost with the worker, which is fine. */
  const hot = new Map<string, number>();
  /**
   * Replies claude.ai took whose confirmation did not reach Oppenheimer, and
   * since when: confirmed again on every turn, so the claim does not lapse
   * and hand an already delivered reply to the Stop hook a second time.
   */
  const unconfirmed = new Map<string, number>();
  /** The last refused post, said in the popup until a post goes or its claim lapses. */
  let refusal: { reason: string; until: number } | null = null;
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
      await confirmDeliveries(oppenheimer);
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
        const claimedAt = Date.now();
        const headers = await claudeHeaders();
        for (const reply of replies) {
          // A claim near its lease's end is handed back, not posted: past the
          // lease the Stop hook may take it, and a post then would be the
          // second delivery. One started in time finishes inside the lease.
          if (Date.now() - claimedAt > POST_START_WITHIN_MS) {
            await releaseReply(oppenheimer, reply.id, 'lease').catch(() => {});
            continue;
          }
          const posted = await postReply(reply, headers, postToClaude);
          if (posted.outcome !== 'refused') {
            // Taken, or maybe taken: either way it is this extension's to
            // confirm, so the claim never lapses into a second delivery.
            refusal = null;
            hot.set(reply.cloudSessionId, Date.now());
            unconfirmed.set(reply.id, Date.now());
          } else {
            // A refused post keeps its claim until the lease lapses: the
            // reply then waits for the Stop hook or a host, and this
            // extension, which cannot claim it meanwhile, tries it at most
            // once a lease. Releasing it would have it claimed and refused
            // again at once.
            refusal = {
              reason: posted.reason,
              until: Date.now() + BROWSER_REPLY_LEASE_SECONDS * 1000,
            };
          }
        }
        await confirmDeliveries(oppenheimer);
        // claude.ai asked to slow down: nothing goes to it for a while.
        if (refusal?.reason === '429')
          await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
      }
      const synced = await serial(syncPass);
      // What the popup says: a pass that could not carry a log, else a refused post.
      if (refusal && Date.now() > refusal.until) refusal = null;
      const problem = synced ?? (refusal ? `claude.ai refused a reply (${refusal.reason})` : null);
      if (problem) await writeState({ chatProblem: { at: now(), detail: problem } });
      else await clearChatProblem();
    }
  }

  /**
   * One pass over the sessions that are moving: reads each one's log from
   * claude.ai and sends the console what it does not have yet. A session the
   * console has not seen is adopted there by the first batch.
   */
  /**
   * Tells Oppenheimer which posted replies claude.ai took. One that does not
   * get through stays to be told again, for as long as telling can still
   * matter: an answer of `false` means another way already has it, and past
   * ten minutes the claim is long gone either way.
   */
  async function confirmDeliveries(connection: OppenheimerConnection) {
    for (const [replyId, since] of unconfirmed) {
      if (Date.now() - since > CONFIRM_FOR_MS) {
        unconfirmed.delete(replyId);
        continue;
      }
      try {
        await confirmReply(connection, replyId);
        unconfirmed.delete(replyId);
      } catch {
        // Told again on the next turn.
      }
    }
  }

  /** Reads the sessions that are moving; answers why one could not be carried, or null. */
  async function syncPass(): Promise<string | null> {
    const state = await readState();
    if (!state.oppenheimer) return null;
    const clock = Date.now();
    for (const [id, at] of hot) if (clock - at > HOT_MS) hot.delete(id);
    const synced: Record<string, ChatSync> = { ...state.chatSync };
    const due = sessionsToSync(Object.values(state.sessions), synced, new Set(hot.keys()), clock);
    if (due.length === 0) return null;
    const headers = await claudeHeaders();
    let problem: string | null = null;
    // One session's failure (a refused batch, a log claude.ai will not give)
    // is said, and the others in the pass still go.
    for (const session of due.slice(0, SESSIONS_PER_PASS)) {
      // A sync kept under older copy rules reads the log again from its first page.
      const known = current(synced[session.id]);
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
          synced[session.id] = {
            sent: known?.sent ?? 0,
            at: known?.at ?? '',
            readAt: now(),
            copy: known?.copy,
          };
          // No route gave its log: the console's copy is stale, which the popup says.
          problem ??= `${session.id}: claude.ai gave no event log`;
          continue;
        }
        // A copy started here is sent newest first when the whole log came;
        // a log too long for one read goes oldest stretch first.
        const sent = known
          ? await forwardEvents(
              state.oppenheimer,
              session,
              read.events,
              Math.max(0, known.sent - read.offset),
              read.offset,
            )
          : read.offset === 0 && read.complete
            ? await forwardNewestFirst(state.oppenheimer, session, read.events)
            : await forwardEvents(state.oppenheimer, session, read.events, 0, read.offset);
        synced[session.id] = {
          copy: CHAT_COPY_VERSION,
          sent: read.offset + sent,
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
    return problem;
  }

  return { run, syncPass };
}

function now() {
  return new Date().toISOString();
}
