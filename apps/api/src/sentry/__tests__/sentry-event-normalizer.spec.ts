import type { InboundDelivery } from '../../inbound-events/domain/external-event.types';
import { normalizeSentryDelivery } from '../infrastructure/sentry-event-normalizer.util';

/**
 * Sentry's webhooks as catalog events. What breaks this: Sentry retrying an
 * `issue.created` webhook starting a second run for the same issue; a second
 * regression of the same issue never starting one; a resolve or an assign
 * starting one at all; an error's message reaching the attributes a filter
 * matches on.
 */
function delivery(
  eventName: string,
  body: Record<string, unknown>,
  deliveryId = 'req-1',
): InboundDelivery {
  return {
    id: 'd1',
    source: 'sentry',
    deliveryId,
    eventName,
    receivedAt: new Date('2026-11-02T10:00:00.000Z'),
    payload: {
      connectionId: 'conn-1',
      organizationId: 'org-1',
      organizationSlug: 'acme',
      resource: eventName.split('.')[0],
      body,
    },
  };
}

const issue = (extra: Record<string, unknown> = {}) => ({
  id: '4501',
  shortId: 'API-1Z',
  title: "TypeError: Cannot read properties of undefined (reading 'id')",
  culprit: 'RunBotTurnCommandHandler.run',
  level: 'error',
  status: 'unresolved',
  web_url: 'https://acme.sentry.io/issues/4501/',
  project: { id: '7', slug: 'oppenheimer-api', name: 'API' },
  metadata: { type: 'TypeError', value: "Cannot read properties of undefined (reading 'id')" },
  count: '12',
  lastSeen: '2026-11-02T09:59:00.000Z',
  ...extra,
});

describe('normalizeSentryDelivery', () => {
  it('makes a new issue one event per issue, filtered by its project', () => {
    const first = normalizeSentryDelivery(
      delivery('issue.created', { action: 'created', data: { issue: issue() } }, 'req-1'),
    );
    const retried = normalizeSentryDelivery(
      delivery('issue.created', { action: 'created', data: { issue: issue() } }, 'req-2'),
    );

    expect(first).toEqual([
      {
        source: 'sentry',
        type: 'issue_created',
        externalId: 'conn-1:issue_created:4501',
        subject: { kind: 'sentry_connection', ref: 'conn-1', name: 'acme' },
        actor: { login: null, isOwnApp: false },
        attributes: {
          project: 'oppenheimer-api',
          rule: null,
          level: 'error',
          environment: null,
          issueId: '4501',
        },
        context: {
          ref: 'API-1Z',
          title: "TypeError: Cannot read properties of undefined (reading 'id')",
          body: "In RunBotTurnCommandHandler.run\nTypeError: Cannot read properties of undefined (reading 'id')",
          url: 'https://acme.sentry.io/issues/4501/',
          level: 'error',
          project: 'oppenheimer-api',
          environment: undefined,
          rule: undefined,
          timesSeen: 12,
        },
        occurredAt: new Date('2026-11-02T09:59:00.000Z'),
        schemaVersion: 1,
      },
    ]);
    expect(retried[0]?.externalId).toBe(first[0]?.externalId);
  });

  it('makes each regression and escalation its own event, and ignores other unresolves', () => {
    const regressed = (id: string) =>
      normalizeSentryDelivery(
        delivery(
          'issue.unresolved',
          { action: 'unresolved', data: { issue: issue({ substatus: 'regressed' }) } },
          id,
        ),
      );
    expect(regressed('a')[0]).toMatchObject({ type: 'issue_regressed' });
    expect(regressed('a')[0]?.externalId).not.toBe(regressed('b')[0]?.externalId);

    const escalating = normalizeSentryDelivery(
      delivery('issue.unresolved', {
        action: 'unresolved',
        data: { issue: issue({ substatus: 'escalating' }) },
      }),
    );
    expect(escalating[0]).toMatchObject({ type: 'issue_escalating' });

    const reopenedByHand = normalizeSentryDelivery(
      delivery('issue.unresolved', {
        action: 'unresolved',
        data: { issue: issue({ substatus: 'ongoing' }) },
      }),
    );
    expect(reopenedByHand).toEqual([]);
    expect(
      normalizeSentryDelivery(
        delivery('issue.resolved', { action: 'resolved', data: { issue: issue() } }),
      ),
    ).toEqual([]);
  });

  it('makes an alert one event narrowed by the rule that fired', () => {
    const [event] = normalizeSentryDelivery(
      delivery('event_alert.triggered', {
        action: 'triggered',
        data: {
          triggered_rule: 'Errors in production',
          event: {
            event_id: 'e1',
            issue_id: '4501',
            title: 'Error: boom',
            culprit: 'GET /api/v1/hosts',
            level: 'fatal',
            environment: 'production',
            issue_url: 'https://acme.sentry.io/issues/4501/',
            datetime: '2026-11-02T09:58:00.000Z',
            metadata: { type: 'Error', value: 'boom' },
          },
        },
      }),
    );

    expect(event).toMatchObject({
      type: 'alert_triggered',
      externalId: 'conn-1:alert_triggered:4501:req-1',
      attributes: { rule: 'Errors in production', project: null, environment: 'production' },
      context: { title: 'Error: boom', url: 'https://acme.sentry.io/issues/4501/', level: 'fatal' },
    });
  });

  it('makes nothing of a body with no issue in it', () => {
    expect(normalizeSentryDelivery(delivery('issue.created', { action: 'created' }))).toEqual([]);
  });
});
