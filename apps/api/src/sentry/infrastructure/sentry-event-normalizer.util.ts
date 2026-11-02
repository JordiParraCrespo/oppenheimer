import type { SentryEventType } from '@oppenheimer/shared/automations';
import {
  EXTERNAL_CONTEXT_BODY_MAX,
  type ExternalEvent,
  type InboundDelivery,
} from '../../inbound-events/domain/external-event.types';

/** What the webhook hands the hub: which connection it came through, and Sentry's body. */
export interface SentryDeliveryPayload {
  connectionId: string;
  organizationId: string;
  organizationSlug: string;
  /** `Sentry-Hook-Resource`: `issue`, `event_alert`, … */
  resource: string;
  body: Record<string, unknown>;
}

/** The hub's event names this source turns into catalog events: `<resource>.<action>`. */
export const SENTRY_WEBHOOK_EVENTS = ['issue.created', 'issue.unresolved', 'event_alert.triggered'];

/** A delivery's hub event name. */
export function sentryEventName(resource: string, body: Record<string, unknown>): string {
  const action = typeof body.action === 'string' ? body.action : '';
  return `${resource}.${action}`;
}

/**
 * A Sentry webhook as catalog events (`next-steps/sentry.md`). An issue
 * created is one event per issue, however often Sentry retries the webhook;
 * a regression, an escalation and an alert are one per delivery, since each
 * is a new occurrence of something already known. What the error says (its
 * title, culprit, message) is the failing code's and its input's, so it is
 * untrusted context; the attributes are the project's slug and the rule's
 * name, which the owner chose. Pure.
 */
export function normalizeSentryDelivery(delivery: InboundDelivery): ExternalEvent[] {
  const payload = payloadOf(delivery.payload);
  if (!payload) return [];
  const type = typeOf(delivery.eventName, payload.body);
  if (!type) return [];
  const facts = type === 'alert_triggered' ? alertFacts(payload.body) : issueFacts(payload.body);
  if (!facts) return [];
  const once = type === 'issue_created' ? facts.issueId : `${facts.issueId}:${delivery.deliveryId}`;
  return [
    {
      source: 'sentry',
      type,
      externalId: `${payload.connectionId}:${type}:${once}`,
      subject: {
        kind: 'sentry_connection',
        ref: payload.connectionId,
        name: payload.organizationSlug,
      },
      actor: { login: null, isOwnApp: false },
      attributes: {
        project: facts.project,
        rule: facts.rule,
        level: facts.level,
        environment: facts.environment,
        issueId: facts.issueId,
      },
      context: {
        ref: facts.shortId ?? facts.issueId,
        title: facts.title,
        body: facts.body.slice(0, EXTERNAL_CONTEXT_BODY_MAX),
        url: facts.url,
        level: facts.level ?? undefined,
        project: facts.project ?? undefined,
        environment: facts.environment ?? undefined,
        rule: facts.rule ?? undefined,
        timesSeen: facts.count ?? undefined,
      },
      occurredAt: facts.at ?? delivery.receivedAt,
      schemaVersion: 1,
    },
  ];
}

function typeOf(eventName: string, body: Record<string, unknown>): SentryEventType | null {
  if (eventName === 'issue.created') return 'issue_created';
  if (eventName === 'event_alert.triggered') return 'alert_triggered';
  if (eventName === 'issue.unresolved') {
    const substatus = text(record(record(body.data).issue).substatus);
    if (substatus === 'regressed') return 'issue_regressed';
    if (substatus === 'escalating') return 'issue_escalating';
  }
  return null;
}

interface Facts {
  issueId: string;
  shortId: string | null;
  title: string;
  body: string;
  url: string | undefined;
  level: string | null;
  project: string | null;
  environment: string | null;
  rule: string | null;
  count: number | null;
  at: Date | null;
}

/** An `issue` webhook's issue. */
function issueFacts(body: Record<string, unknown>): Facts | null {
  const issue = record(record(body.data).issue);
  const issueId = text(issue.id);
  if (!issueId) return null;
  const metadata = record(issue.metadata);
  return {
    issueId,
    shortId: text(issue.shortId),
    title: text(issue.title) ?? 'Sentry issue',
    body: describe(text(issue.culprit), text(metadata.type), text(metadata.value)),
    url: text(issue.web_url) ?? text(issue.permalink) ?? undefined,
    level: text(issue.level),
    project: text(record(issue.project).slug),
    environment: null,
    rule: null,
    count: Number.isFinite(Number(issue.count)) ? Number(issue.count) : null,
    at: dateOf(issue.lastSeen) ?? dateOf(issue.firstSeen),
  };
}

/**
 * An `event_alert` webhook's event: the event that tripped the rule. It names
 * its project by numeric id only, so `project` is null and a trigger narrows
 * an alert by its rule.
 */
function alertFacts(body: Record<string, unknown>): Facts | null {
  const data = record(body.data);
  const event = record(data.event);
  const issueId = text(event.issue_id) ?? text(event.event_id);
  if (!issueId) return null;
  const metadata = record(event.metadata);
  return {
    issueId,
    shortId: null,
    title: text(event.title) ?? 'Sentry alert',
    body: describe(text(event.culprit), text(metadata.type), text(metadata.value)),
    url: text(event.issue_url) ?? text(event.web_url) ?? undefined,
    level: text(event.level),
    project: null,
    environment: text(event.environment),
    rule: text(data.triggered_rule),
    count: null,
    at: dateOf(event.datetime) ?? dateOf(event.timestamp),
  };
}

function describe(culprit: string | null, type: string | null, value: string | null): string {
  const error = type && value ? `${type}: ${value}` : (type ?? value);
  return [culprit ? `In ${culprit}` : null, error].filter(Boolean).join('\n');
}

function payloadOf(input: Record<string, unknown>): SentryDeliveryPayload | null {
  const connectionId = text(input.connectionId);
  const resource = text(input.resource);
  if (!connectionId || !resource) return null;
  return {
    connectionId,
    organizationId: text(input.organizationId) ?? '',
    organizationSlug: text(input.organizationSlug) ?? '',
    resource,
    body: record(input.body),
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function dateOf(value: unknown): Date | null {
  const date =
    typeof value === 'string'
      ? new Date(value)
      : typeof value === 'number'
        ? new Date(value * 1000)
        : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}
