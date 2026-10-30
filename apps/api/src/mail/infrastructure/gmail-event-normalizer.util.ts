import type {
  ExternalEvent,
  InboundDelivery,
} from '../../inbound-events/domain/external-event.types';
import { EXTERNAL_CONTEXT_BODY_MAX } from '../../inbound-events/domain/external-event.types';
import type { GmailMessageSummary } from './gmail-provider.port';

/** What the poll hands the hub as one delivery: the new mail of one account, since one history mark. */
export type GmailDeliveryPayload = {
  connectionId: string;
  organizationId: string;
  accountEmail: string;
  messages: GmailDeliveredMessage[];
};

export type GmailDeliveredMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  /** ISO 8601; when Gmail received it. */
  date: string;
  /** The watched queries it matched: a trigger with a query fires when its query is here. */
  matched: string[];
};

/** One account's taken mail as the poll hands it to the hub. */
export function toGmailDelivery(
  connection: { id: string; organizationId: string; accountEmail: string },
  summaries: readonly GmailMessageSummary[],
  taken: readonly { id: string; matched: string[] }[],
): GmailDeliveryPayload {
  return {
    connectionId: connection.id,
    organizationId: connection.organizationId,
    accountEmail: connection.accountEmail,
    messages: summaries.map((summary) => ({
      id: summary.id,
      threadId: summary.threadId,
      from: summary.from,
      subject: summary.subject,
      snippet: summary.snippet,
      date: (summary.date ?? new Date()).toISOString(),
      matched: taken.find(({ id }) => id === summary.id)?.matched ?? [],
    })),
  };
}

/** The hub's event name for a poll's delivery. */
export const GMAIL_DELIVERY_EVENT = 'mail_received';

/**
 * A poll's delivery as catalog events (`next-steps/mail.md` §5): one
 * `mail_received` per message, unique per account and message so a message
 * read twice is one event. Who wrote it, the subject and the snippet are the
 * sender's, so they are the event's untrusted context, never its attributes;
 * the attribute is the list of watched queries it matched, which a trigger's
 * filter is found in. Pure.
 */
export function normalizeGmailDelivery(delivery: InboundDelivery): ExternalEvent[] {
  const payload = deliveryOf(delivery.payload);
  if (!payload) return [];
  return payload.messages.map((message) => ({
    source: 'gmail',
    type: 'mail_received',
    externalId: `${payload.connectionId}:${message.id}`,
    subject: { kind: 'gmail_connection', ref: payload.connectionId, name: payload.accountEmail },
    actor: { login: message.from || null, isOwnApp: false },
    attributes: { query: message.matched },
    context: {
      ref: message.id,
      title: message.subject,
      body: message.snippet.slice(0, EXTERNAL_CONTEXT_BODY_MAX),
      from: message.from,
      threadId: message.threadId,
      url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(payload.accountEmail)}#all/${encodeURIComponent(message.id)}`,
    },
    occurredAt: new Date(message.date),
    schemaVersion: 1,
  }));
}

/** The poll's payload read back from the stored delivery, or null when it is not one. */
function deliveryOf(input: Record<string, unknown>): GmailDeliveryPayload | null {
  const { connectionId, organizationId, accountEmail, messages } = input;
  if (typeof connectionId !== 'string' || typeof accountEmail !== 'string') return null;
  if (!Array.isArray(messages)) return null;
  return {
    connectionId,
    organizationId: typeof organizationId === 'string' ? organizationId : '',
    accountEmail,
    messages: messages.flatMap((message: unknown) => {
      const read = messageOf(message);
      return read ? [read] : [];
    }),
  };
}

function messageOf(input: unknown): GmailDeliveredMessage | null {
  if (typeof input !== 'object' || input === null) return null;
  const text = (key: string): string => {
    const value = (input as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : '';
  };
  const matched = (input as Record<string, unknown>).matched;
  const id = text('id');
  if (!id) return null;
  return {
    id,
    threadId: text('threadId'),
    from: text('from'),
    subject: text('subject'),
    snippet: text('snippet'),
    date: text('date') || new Date(0).toISOString(),
    matched: Array.isArray(matched)
      ? matched.filter((query): query is string => typeof query === 'string')
      : [],
  };
}
