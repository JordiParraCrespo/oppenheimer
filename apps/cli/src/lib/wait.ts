import type { BotApproval, BotConversation, BotMessage, BotTurn, Session } from './api-types';
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

/**
 * Whether a session has stopped needing time: its agent is through with the
 * task (idle, ready for review, landing), waits on somebody (a question, a
 * permission, a failure), or the session has ended. A session still starting
 * or working is not settled.
 */
export function isSettled(session: Pick<Session, 'state' | 'lifecycle'>): boolean {
  if (session.lifecycle === 'failed' || session.lifecycle === 'resolved') return true;
  if (session.lifecycle === 'starting') return false;
  return session.state !== 'working';
}

/**
 * Poll until every session is settled or the time runs out. Answers each
 * session as last read, and whether all of them settled; the sessions keep
 * running past a timeout.
 */
export async function waitForSessions(
  client: ApiClient,
  ids: readonly string[],
  options: PollOptions,
): Promise<{ settled: boolean; sessions: Session[] }> {
  const sleep = options.sleep ?? realSleep;
  const now = options.now ?? Date.now;
  const deadline = now() + options.timeoutMs;
  for (;;) {
    const sessions = await Promise.all(ids.map((id) => client.get<Session>(`/sessions/${id}`)));
    if (sessions.every(isSettled)) return { settled: true, sessions };
    if (now() + options.intervalMs > deadline) return { settled: false, sessions };
    await sleep(options.intervalMs);
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
