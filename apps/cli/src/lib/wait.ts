import { agentTookWorkAfter, isSessionSettled, isWorkSettled } from '@oppenheimer/shared/sessions';
import type {
  BotApproval,
  BotConversation,
  BotMessage,
  BotTurn,
  Session,
  SessionLogPage,
} from './api-types';
import type { ApiClient } from './client';

/**
 * Waiting on work that happens somewhere else: a session's agent on a host, a
 * bot's turn in the control plane. Both poll the API, which already folds what
 * the host reports into one state, so the CLI never needs a socket.
 */

export interface PollOptions {
  timeoutMs: number;
  intervalMs: number;
  /** Overridable so tests run without real time passing. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** What the log has shown so far about one session's work, carried from one poll to the next. */
interface WorkWatch {
  /** The `seq` to read the log on from. */
  cursor: number;
  tookWork: boolean;
}

/**
 * Poll until every session is settled or the time runs out. Answers each
 * session as last read, and whether all of them settled; the sessions keep
 * running past a timeout.
 *
 * With `afterSeq`, the wait is on work given at that point of each session's
 * log (a prompt just sent, a first task): an idle session is not settled
 * until the log shows its agent took the work, so the state from before the
 * work is never reported as its outcome.
 */
export async function waitForSessions(
  client: ApiClient,
  ids: readonly string[],
  options: PollOptions & { afterSeq?: number },
): Promise<{ settled: boolean; sessions: Session[] }> {
  const sleep = options.sleep ?? realSleep;
  const now = options.now ?? Date.now;
  const deadline = now() + options.timeoutMs;
  const afterSeq = options.afterSeq;
  const watches = new Map<string, WorkWatch>(
    ids.map((id) => [id, { cursor: afterSeq ?? 0, tookWork: false }]),
  );
  for (;;) {
    const sessions = await Promise.all(ids.map((id) => client.get<Session>(`/sessions/${id}`)));
    if (afterSeq !== undefined) {
      await Promise.all(
        ids.map((id) => readOn(client, id, watches.get(id) as WorkWatch, afterSeq)),
      );
    }
    const settled = sessions.every((session) =>
      afterSeq === undefined
        ? isSessionSettled(session)
        : isWorkSettled(session, (watches.get(session.id) as WorkWatch).tookWork),
    );
    if (settled) return { settled: true, sessions };
    if (now() + options.intervalMs > deadline) return { settled: false, sessions };
    await sleep(options.intervalMs);
  }
}

/** Read a session's log on from the watch's cursor, to its end, noting whether the agent took the work. */
async function readOn(
  client: ApiClient,
  id: string,
  watch: WorkWatch,
  afterSeq: number,
): Promise<void> {
  while (!watch.tookWork) {
    const page = await client.get<SessionLogPage>(`/sessions/${id}/events`, {
      query: { afterSeq: watch.cursor, limit: 100 },
    });
    if (agentTookWorkAfter(page.data, afterSeq)) watch.tookWork = true;
    const last = page.data.at(-1)?.seq;
    if (last !== undefined) watch.cursor = last;
    if (page.nextSeq === null || last === undefined) return;
  }
}

/** A turn that will not move again on its own. */
export function isTurnOver(turn: Pick<BotTurn, 'status'>): boolean {
  return turn.status === 'completed' || turn.status === 'failed' || turn.status === 'cancelled';
}

/**
 * What a turn has to show: its own replies, and the approval cards it raised
 * that wait on a person (the bot cannot go on until one is decided).
 */
export function turnOutcome(
  conversation: BotConversation,
  approvals: readonly BotApproval[],
  turnId: string,
): { turn: BotTurn | undefined; replies: BotMessage[]; pending: BotApproval[] } {
  const turn = conversation.turns.find((candidate) => candidate.id === turnId);
  const replies = conversation.messages.filter(
    (message) =>
      message.turnId === turnId && message.role === 'assistant' && message.content.trim() !== '',
  );
  const pending = approvals.filter(
    (approval) => approval.turnId === turnId && approval.status === 'pending',
  );
  return { turn, replies, pending };
}

/** Poll a bot's conversation until the turn is over, waits on you, or time runs out. */
export async function waitForTurn(
  client: ApiClient,
  botId: string,
  turnId: string,
  options: PollOptions,
): Promise<ReturnType<typeof turnOutcome> & { timedOut: boolean }> {
  const sleep = options.sleep ?? realSleep;
  const now = options.now ?? Date.now;
  const deadline = now() + options.timeoutMs;
  for (;;) {
    const [conversation, approvals] = await Promise.all([
      client.get<BotConversation>(`/bots/${botId}/conversation`),
      client.get<BotApproval[]>(`/bots/${botId}/approvals`),
    ]);
    const outcome = turnOutcome(conversation, approvals, turnId);
    if ((outcome.turn && isTurnOver(outcome.turn)) || outcome.pending.length > 0) {
      return { ...outcome, timedOut: false };
    }
    if (now() + options.intervalMs > deadline) return { ...outcome, timedOut: true };
    await sleep(options.intervalMs);
  }
}

/** `30s`, `10m`, `2h` or a bare number of seconds, in milliseconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/.exec(value.trim());
  if (!match) throw new Error(`"${value}" is not a duration (try 30s, 10m or 2h).`);
  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  const factor = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 }[unit] ?? 1_000;
  return Math.round(amount * factor);
}
