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

/** How long a session a reply was posted to is read every `HOT_READ_MS`. */
const HOT_MS = 3 * 60_000;
/** How often a session just replied to is read, and how often the hot loop looks for one. */
const HOT_READ_MS = 2_000;
const IDLE_HOT_MS = 1_000;
/** The shortest a turn of the reply loop takes when no reply came. */
const MIN_CLAIM_MS = 1_000;
/** How long the loop waits for a reply while a session is running, and while none is. */
const BUSY_WAIT_SECONDS = 3;
const IDLE_WAIT_SECONDS = 10;
/** Sessions whose log one pass reads, at most. */
const SESSIONS_PER_PASS = 10;
/** How long a pass goes on starting sessions, so a pass ends and the next one reorders. */
const PASS_BUDGET_MS = 20_000;
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
 * The chat bridge between claude.ai and the person's Oppenheimer, while
 * Oppenheimer is connected. Three loops that never wait on each other:
 *
 * - **replies**: claims the replies typed in the console and posts them on
 *   claude.ai at once;
 * - **hot**: reads a session just replied to every few seconds, so the
 *   person's message and the agent's answer reach the console as they come;
 * - **sync**: carries the logs of the sessions that are moving, which for a
 *   long log can take minutes.
 *
 * It owns what they keep: the sessions just replied to, the pass's cap and
 * order, and where each log has got to (`chatSync`, each session's place
 * written on its own so the loops never undo each other). What it does to a
 * request is `chat.ts`.
 */
export function createChatBridge({
  claudeHeaders,
  serial,
  postToClaude,
}: ChatBridgeDeps): ChatBridge {
  /** Sessions a reply was just posted to, and when. Lost with the worker, which is fine. */
  const hot = new Map<string, number>();
  /** Sessions being read right now, by either loop: one read of a log at a time. */
  const reading = new Set<string>();
  /**
   * Replies claude.ai took whose confirmation did not reach Oppenheimer, and
   * since when: confirmed again on every turn, so the claim does not lapse
   * and hand an already delivered reply to the Stop hook a second time.
   */
  const unconfirmed = new Map<string, number>();
  /** The last refused post, said in the popup until a post goes or its claim lapses. */
  let refusal: { reason: string; until: number } | null = null;
  /** Why the last pass could not carry a log, said in the popup. */
  let syncProblem: string | null = null;
  /**
   * The loops running now, each on its own: a disconnect ends the reply and
   * hot loops at once while the sync loop may be mid-read, and a reconnect
   * then has to start the ones that ended, not wait for all three.
   */
  const running = new Set<() => Promise<void>>();

  function run() {
    for (const loop of [replyLoop, hotLoop, syncLoop]) {
      if (running.has(loop)) continue;
      running.add(loop);
      void loop().finally(() => running.delete(loop));
    }
  }

  async function connected() {
    return (await readState()).oppenheimer ?? null;
  }

  async function sayProblem() {
    if (refusal && Date.now() > refusal.until) refusal = null;
    const problem =
      syncProblem ?? (refusal ? `claude.ai refused a reply (${refusal.reason})` : null);
    if (problem) await writeState({ chatProblem: { at: now(), detail: problem } });
    else await clearChatProblem();
  }

  async function replyLoop() {
    for (;;) {
      const { oppenheimer, sessions } = await readState();
      if (!oppenheimer) return;
      await confirmDeliveries(oppenheimer);
      const busy = Object.values(sessions).some((session) => session.state === 'running');
      let replies: ClaimedReply[] = [];
      const asked = Date.now();
      try {
        replies = await claimReplies(
          oppenheimer,
          busy || hot.size > 0 ? BUSY_WAIT_SECONDS : IDLE_WAIT_SECONDS,
        );
      } catch (error) {
        await writeState({
          chatProblem: { at: now(), detail: String((error as Error).message ?? error) },
        });
        await sleep(RETRY_MS);
        continue;
      }
      if (replies.length === 0) {
        // The API holds a claim open while it waits; one that answered at once
        // (a proxy, an older API) must not turn this into a busy loop.
        if (Date.now() - asked < MIN_CLAIM_MS) await sleep(MIN_CLAIM_MS);
        continue;
      }
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
      await sayProblem();
      // claude.ai asked to slow down: nothing goes to it for a while.
      if (refusal?.reason === '429') await sleep(RETRY_MS);
    }
  }

  /** Reads each session just replied to every few seconds, whatever the sync loop is doing. */
  async function hotLoop() {
    for (;;) {
      if (!(await connected())) return;
      const clock = Date.now();
      for (const [id, at] of hot) if (clock - at > HOT_MS) hot.delete(id);
      for (const id of hot.keys()) {
        if (reading.has(id)) continue;
        await syncOne(id).catch(() => null);
      }
      await sleep(hot.size > 0 ? HOT_READ_MS : IDLE_HOT_MS);
    }
  }

  async function syncLoop() {
    for (;;) {
      if (!(await connected())) return;
      syncProblem = await syncPass();
      await sayProblem();
      const { sessions } = await readState();
      const busy = Object.values(sessions).some((session) => session.state === 'running');
      await sleep((busy ? BUSY_WAIT_SECONDS : IDLE_WAIT_SECONDS) * 1000);
    }
  }

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

  /** Writes one session's place, leaving the others' as the other loop left them. */
  function keep(sessionId: string, sync: ChatSync, under: OppenheimerConnection) {
    return serial(async () => {
      const { chatSync, sessions, oppenheimer } = await readState();
      // Disconnected meanwhile, or connected elsewhere: the place was the
      // old connection's, and kept now it would skip those events on the next.
      if (oppenheimer?.apiUrl !== under.apiUrl || oppenheimer?.token !== under.token) return;
      const kept = Object.fromEntries(
        Object.entries({ ...chatSync, [sessionId]: sync }).filter(([id]) => id in sessions),
      );
      await writeState({ chatSync: kept });
    });
  }

  /**
   * Reads one session's log from where the console's copy got to and sends
   * it what it lacks; answers why it could not, or null. Each session's place
   * is kept as soon as it is carried: the worker can be stopped at any time.
   */
  async function syncOne(sessionId: string): Promise<string | null> {
    if (reading.has(sessionId)) return null;
    reading.add(sessionId);
    try {
      const state = await readState();
      const session = state.sessions[sessionId];
      const connection = state.oppenheimer;
      if (!connection || !session) return null;
      const keepHere = (sync: ChatSync) => keep(sessionId, sync, connection);
      // A sync kept under older copy rules reads the log again from its first page.
      const known = current(state.chatSync?.[sessionId]);
      try {
        const read = await fetchSessionEvents(
          sessionId,
          await claudeHeaders(),
          state.eventsEndpoint ?? null,
          known?.resume ?? null,
        );
        if (!read) {
          // A place to carry on from that no longer answers is dropped: the
          // next read starts from the first page.
          await keepHere({
            sent: known?.sent ?? 0,
            at: known?.at ?? '',
            readAt: now(),
            copy: known?.copy,
          });
          // No route gave its log: the console's copy is stale, which the popup says.
          return `${sessionId}: claude.ai gave no event log`;
        }
        // A copy started here is sent newest first when the whole log came;
        // a log too long for one read goes oldest stretch first.
        const sent = known
          ? await forwardEvents(
              connection,
              session,
              read.events,
              Math.max(0, known.sent - read.offset),
              read.offset,
            )
          : read.offset === 0 && read.complete
            ? await forwardNewestFirst(connection, session, read.events)
            : await forwardEvents(connection, session, read.events, 0, read.offset);
        await keepHere({
          copy: CHAT_COPY_VERSION,
          sent: read.offset + sent,
          // Up to date only once read to the end; a read cut short is due again.
          at: read.complete ? (session.updatedAt ?? now()) : (known?.at ?? ''),
          resume: read.resume,
          readAt: now(),
        });
        return null;
      } catch (error) {
        await keepHere({
          ...known,
          sent: known?.sent ?? 0,
          at: known?.at ?? '',
          readAt: now(),
        });
        return `${sessionId}: ${String((error as Error).message ?? error)}`;
      }
    } finally {
      reading.delete(sessionId);
    }
  }

  /** Reads the sessions that are moving; answers why one could not be carried, or null. */
  async function syncPass(): Promise<string | null> {
    const state = await readState();
    if (!state.oppenheimer) return null;
    const clock = Date.now();
    const due = sessionsToSync(
      Object.values(state.sessions),
      state.chatSync ?? {},
      new Set(hot.keys()),
      clock,
    );
    let problem: string | null = null;
    // One session's failure (a refused batch, a log claude.ai will not give)
    // is said, and the others in the pass still go.
    for (const session of due.slice(0, SESSIONS_PER_PASS)) {
      if (Date.now() - clock > PASS_BUDGET_MS) break;
      // Read before `??=`, which would skip the call once one has failed.
      const failed = await syncOne(session.id);
      problem ??= failed;
    }
    return problem;
  }

  return { run, syncPass };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function now() {
  return new Date().toISOString();
}
