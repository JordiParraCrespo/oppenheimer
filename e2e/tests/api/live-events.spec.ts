import { type APIRequestContext, expect, test } from '@playwright/test';
import { API_URL } from '../../playwright.config';
import { expectProblemDocument, signedUpContext } from '../../support/auth';
import { setUserRole } from '../../support/db';
import {
  connectInstallation,
  createProject,
  pairHost,
  STUB_REPOSITORIES,
} from '../../support/sessions';

/**
 * The live stream through the deployed pipeline: the guards and the flag in
 * front of `GET /v1/live`, a domain event leaving the outbox, Redis, and the
 * SSE response. The fan-out across replicas is proved against a real Redis in
 * `apps/api/src/live/__tests__/live-events.integration.spec.ts`; what is proved
 * here is that a session created through the API reaches its owner's open
 * stream, and that a caller the flag leaves out is refused.
 */

/** What `@oppenheimer/shared/live` declares; this suite reads the wire, not the package. */
type LiveEvent = { type: 'session.changed'; sessionId: string };

/** Switch `live_events` on for one user and nobody else. */
async function enableLiveEventsFor(api: APIRequestContext, userId: string) {
  await setUserRole(userId, 'admin');
  const response = await api.put('/api/v1/feature-flags/admin/live_events', {
    data: {
      enabled: true,
      rules: [
        {
          id: 'e2e-live-events',
          conditions: [{ attribute: 'userId', operator: 'in', values: [userId] }],
          serve: { value: true },
        },
      ],
      fallthrough: { value: false },
      comment: 'e2e: the live stream',
    },
    failOnStatusCode: false,
  });
  expect(response.status(), await response.text()).toBe(200);
}

/** An open stream, read frame by frame as the browser's EventSource would. */
async function openLive(api: APIRequestContext) {
  const { cookies } = await api.storageState();
  const controller = new AbortController();
  const response = await fetch(`${API_URL}/api/v1/live`, {
    headers: {
      accept: 'text/event-stream',
      cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '),
    },
    signal: controller.signal,
  });
  expect(response.status, response.ok ? '' : await response.text()).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/event-stream');

  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffered = '';

  /** The next `live` event the predicate accepts, skipping pings and the rest. */
  async function next(accept: (event: LiveEvent) => boolean): Promise<LiveEvent> {
    for (;;) {
      const end = buffered.indexOf('\n\n');
      if (end !== -1) {
        const frame = buffered.slice(0, end);
        buffered = buffered.slice(end + 2);
        const lines = frame.split('\n');
        const name = lines
          .find((line) => line.startsWith('event:'))
          ?.slice(6)
          .trim();
        const data = lines
          .find((line) => line.startsWith('data:'))
          ?.slice(5)
          .trim();
        if (name === 'live' && data) {
          const event = JSON.parse(data) as LiveEvent;
          if (accept(event)) return event;
        }
        continue;
      }
      const { value, done } = await reader.read();
      if (done) throw new Error('the live stream ended before the event arrived');
      buffered += decoder.decode(value, { stream: true });
    }
  }

  return { next, close: () => controller.abort() };
}

test.describe('Live events', () => {
  test("a session created through the API reaches its owner's open stream", async () => {
    test.slow();
    const { api, userId } = await signedUpContext('liveowner');
    await enableLiveEventsFor(api, userId);
    const hostId = await pairHost(api, 'Live box');
    const installationId = await connectInstallation(api);
    const projectId = await createProject(api, installationId);
    const live = await openLive(api);

    try {
      const created = await api.post('/api/v1/sessions', {
        headers: { 'Idempotency-Key': `e2e-live-${Date.now()}` },
        data: {
          hostId,
          projectId,
          agent: 'claude-code',
          checkouts: [{ installationId, githubRepoId: STUB_REPOSITORIES.mobile.githubRepoId }],
        },
        failOnStatusCode: false,
      });
      expect(created.status(), await created.text()).toBe(201);
      const session = (await created.json()) as { id: string };

      const heard = await live.next(
        (event) => event.type === 'session.changed' && event.sessionId === session.id,
      );

      expect(heard).toEqual({ type: 'session.changed', sessionId: session.id });
    } finally {
      live.close();
    }
  });

  test('a caller the flag leaves out is refused', async () => {
    const { api } = await signedUpContext('liveoutsider');

    const response = await api.get('/api/v1/live', { failOnStatusCode: false });

    await expectProblemDocument(response, { status: 403, code: 'FLAG_003' });
  });
});
