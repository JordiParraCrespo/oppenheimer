import { cut, formatToolTime } from './bot-tool-text.policy';

/**
 * A session's log as `read_session` says it to the model (issue #493): each
 * entry in words, oldest first. Pure; the reading is the sessions module's
 * `FindLatestSessionEventsQuery`.
 */

/** One log entry as `read_session` shows it; what the log records, never more. */
export interface SessionActivityEntry {
  kind: string;
  source: string;
  payload: unknown;
  occurredAt: Date;
}

/** How much of a prompt, a result or a failure one activity line shows. */
const ACTIVITY_TEXT_MAX = 600;

/**
 * A session's recent log as lines, oldest first (`read_session`). Each entry
 * is said in words; repeated reports of the same agent state fold into one;
 * the sender of a follow-up is named only when the API wrote the entry, so a
 * host cannot put words in a bot's mouth. Kinds it does not know are named,
 * their payloads never shown.
 */
export function describeSessionActivity(
  entries: readonly SessionActivityEntry[],
  timeZone: string,
): string[] {
  const lines: string[] = [];
  let lastObserved: string | null = null;
  for (const entry of entries) {
    const said = describeEntry(entry, lastObserved);
    if (entry.kind === 'agent.observed') lastObserved = textField(entry.payload, 'state');
    if (said) lines.push(`${formatToolTime(entry.occurredAt, timeZone)}: ${said}`);
  }
  return lines;
}

function describeEntry(entry: SessionActivityEntry, lastObserved: string | null): string | null {
  const { payload } = entry;
  const words = (name: string) => cut(textField(payload, name) ?? '', ACTIVITY_TEXT_MAX);
  switch (entry.kind) {
    case 'session.requested':
      return 'session requested';
    case 'session.started':
      return 'started on its host';
    case 'session.failed':
      return `failed${textField(payload, 'detail') ? `: ${words('detail')}` : ''}`;
    case 'session.stopped':
      return 'stopped';
    case 'session.restart_requested':
      return 'restart requested';
    case 'session.restarted':
      return 'restarted';
    case 'session.close_requested':
      return 'close requested';
    case 'session.closed':
      return 'closed';
    case 'session.named':
      return `named "${words('name')}"`;
    case 'session.moved':
      return 'moved to another project';
    case 'prompt.first':
      return `first task: ${words('text')}`;
    case 'prompt.sent':
      return `follow-up prompt${senderOf(entry)}: ${words('text')}`;
    case 'prompt.undelivered':
      return 'that follow-up never reached the host, so the agent did not get it';
    case 'turn.requested':
      return `follow-up requested: ${words('prompt')}`;
    case 'turn.ended':
      return `task ended${textField(payload, 'result') ? `: ${words('result')}` : ''}`;
    case 'agent.observed': {
      const state = textField(payload, 'state');
      return state && state !== lastObserved ? `agent ${state}` : null;
    }
    case 'agent.decision':
      return decisionLine(payload);
    case 'decision.answered':
      return 'the pending decision was answered';
    case 'command.failed':
      return `the host refused ${textField(payload, 'command') ?? 'a command'} (${textField(payload, 'code') ?? 'no code'})`;
    case 'report.published':
      return 'the agent left a report';
    case 'report.acknowledged':
      return 'its report was read';
    default:
      return entry.kind;
  }
}

/** "from bot <id>" when the API recorded it; nothing when a host wrote the entry. */
function senderOf(entry: SessionActivityEntry): string {
  if (entry.source !== 'api') return '';
  const sender = asRecord(asRecord(entry.payload).sender);
  return sender.kind === 'bot' && typeof sender.botId === 'string'
    ? ` from bot ${sender.botId}`
    : '';
}

function decisionLine(payload: unknown): string {
  const decision = asRecord(asRecord(payload).decision);
  if (decision.kind === 'permission') {
    return `agent asks permission: ${cut(String(decision.title ?? ''), ACTIVITY_TEXT_MAX)}`;
  }
  if (decision.kind === 'question') {
    const first = asRecord(Array.isArray(decision.questions) ? decision.questions[0] : null);
    return `agent asks: ${cut(String(first.question ?? ''), ACTIVITY_TEXT_MAX)}`;
  }
  return 'the agent no longer waits on a decision';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function textField(payload: unknown, name: string): string | null {
  const value = asRecord(payload)[name];
  return typeof value === 'string' && value.trim() ? value : null;
}
