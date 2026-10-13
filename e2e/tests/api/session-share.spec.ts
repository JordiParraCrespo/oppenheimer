import { expect, test } from '@playwright/test';
import {
  expectProblemDocument,
  newContext,
  signedUpContext,
  signIn,
  VALID_PASSWORD,
} from '../../support/auth';
import { query } from '../../support/db';
import { connectInstallation, createSession, pairHost } from '../../support/sessions';

/**
 * Sharing a session through the deployed pipeline: a member shares it with
 * named people or as a link, and a guest — signed out, signed in elsewhere,
 * or named — opens it through the two `shared-sessions` routes, which take
 * the address in the body and the caller as `OptionalApiAuthGuard` finds
 * them.
 *
 * Who a share opens for is proved on the aggregate
 * (`session-share.entity.spec.ts`), and what the relay does with a ticket
 * minted through one in `relay.gateways.spec.ts`; what is proved here is
 * that the guards, the schema and the error filter agree with them.
 */

/**
 * One owner, host and installation for the file: pairing goes through
 * `POST /hosts/register`, whose rate limit the whole suite shares, so each
 * test makes a session rather than a host.
 */
let owner: Awaited<ReturnType<typeof signedUpContext>>;
let hostId: string;
let installationId: string;

// One worker for the file, so `beforeAll` pairs one host, not one per worker.
test.describe.configure({ mode: 'default' });

test.beforeAll(async () => {
  owner = await signedUpContext('sharer');
  hostId = await pairHost(owner.api, 'Shared box');
  installationId = await connectInstallation(owner.api);
});

interface Share {
  id: string;
  slug: string;
  audience: string;
  access: string;
  people: string[];
}

async function share(sessionId: string, data: Record<string, unknown>): Promise<Share> {
  const put = await owner.api.put(`/api/v1/sessions/${sessionId}/share`, {
    data,
    failOnStatusCode: false,
  });
  expect(put.status(), await put.text()).toBe(200);
  return (await put.json()) as Share;
}

/** A guest's account, verified and signed in afresh, so the session carries it as it is. */
async function verifiedGuest(prefix: string) {
  const guest = await signedUpContext(prefix);
  await query(`UPDATE "user" SET "emailVerified" = true WHERE "id" = $1`, [guest.userId]);
  const api = await newContext();
  expect((await signIn(api, guest.user.email, VALID_PASSWORD)).status()).toBe(200);
  return { api, email: guest.user.email };
}

test.describe('Sharing a session', () => {
  test('a link opens for anyone signed in, keeps its address, and opens nothing once stopped', async () => {
    test.slow();
    const sessionId = await createSession(owner.api, hostId, installationId);
    const shared = await share(sessionId, { audience: 'link', access: 'read', lifetime: '1h' });
    expect(shared.slug).toMatch(/^[A-Za-z0-9_-]{22}$/);

    // The owner reads the same address back, as many times as they like.
    const read = await owner.api.get(`/api/v1/sessions/${sessionId}/share`);
    expect(((await read.json()) as { share: Share }).share.slug).toBe(shared.slug);
    // Sharing again replaces the settings and keeps the address.
    expect(
      (await share(sessionId, { audience: 'link', access: 'read', lifetime: '7d' })).slug,
    ).toBe(shared.slug);

    const signedOut = await newContext();
    const refused = await signedOut.post('/api/v1/shared-sessions/lookup', {
      data: { slug: shared.slug },
      failOnStatusCode: false,
    });
    await expectProblemDocument(refused, { status: 401, code: 'SESSIONS_022' });

    // Signed in to a workspace of their own, which is not the session's.
    const guest = await signedUpContext('guest');
    const lookup = await guest.api.post('/api/v1/shared-sessions/lookup', {
      data: { slug: shared.slug },
      failOnStatusCode: false,
    });
    expect(lookup.status(), await lookup.text()).toBe(200);
    expect(await lookup.json()).toMatchObject({ access: 'read', state: 'live' });

    const ticket = await guest.api.post('/api/v1/shared-sessions/attach-ticket', {
      data: { slug: shared.slug },
      failOnStatusCode: false,
    });
    expect(ticket.status(), await ticket.text()).toBe(201);
    expect(await ticket.json()).toMatchObject({ url: '/api/v1/relay/attach', window: 0 });

    // A share is no way into the session itself.
    const direct = await guest.api.post(`/api/v1/sessions/${sessionId}/attach-ticket`, {
      data: {},
      failOnStatusCode: false,
    });
    await expectProblemDocument(direct, { status: 404, code: 'SESSIONS_001' });

    const stopped = await owner.api.delete(`/api/v1/sessions/${sessionId}/share`, {
      failOnStatusCode: false,
    });
    expect(stopped.status()).toBe(204);
    const after = await guest.api.post('/api/v1/shared-sessions/attach-ticket', {
      data: { slug: shared.slug },
      failOnStatusCode: false,
    });
    await expectProblemDocument(after, { status: 404, code: 'SESSIONS_021' });
    const none = await owner.api.get(`/api/v1/sessions/${sessionId}/share`);
    expect(await none.json()).toEqual({ share: null });
  });

  test('a share for named people opens only for a verified email on its list', async () => {
    test.slow();
    const sessionId = await createSession(owner.api, hostId, installationId);
    const unverified = await signedUpContext('invited');
    const invited = await verifiedGuest('named');
    const uninvited = await verifiedGuest('stranger');
    const shared = await share(sessionId, {
      audience: 'people',
      access: 'write',
      people: [invited.email.toUpperCase(), unverified.user.email],
      lifetime: '8h',
    });
    expect(shared.people).toContain(invited.email.toLowerCase());

    // Signed up, never verified: an address anybody could have typed.
    const claim = await unverified.api.post('/api/v1/shared-sessions/lookup', {
      data: { slug: shared.slug },
      failOnStatusCode: false,
    });
    await expectProblemDocument(claim, { status: 403, code: 'SESSIONS_023' });

    const opened = await invited.api.post('/api/v1/shared-sessions/lookup', {
      data: { slug: shared.slug },
      failOnStatusCode: false,
    });
    expect(opened.status(), await opened.text()).toBe(200);
    expect(await opened.json()).toMatchObject({ access: 'write' });

    const notListed = await uninvited.api.post('/api/v1/shared-sessions/lookup', {
      data: { slug: shared.slug },
      failOnStatusCode: false,
    });
    await expectProblemDocument(notListed, { status: 403, code: 'SESSIONS_023' });

    // Taken off the list, they are refused like anyone else.
    const narrowed = await owner.api.patch(`/api/v1/sessions/${sessionId}/share/people`, {
      data: { people: [unverified.user.email] },
      failOnStatusCode: false,
    });
    expect(narrowed.status(), await narrowed.text()).toBe(200);
    const removed = await invited.api.post('/api/v1/shared-sessions/lookup', {
      data: { slug: shared.slug },
      failOnStatusCode: false,
    });
    await expectProblemDocument(removed, { status: 403, code: 'SESSIONS_023' });
  });

  test('only the session’s workspace shares it, write needs people and a day, and a guess opens nothing', async () => {
    test.slow();
    const sessionId = await createSession(owner.api, hostId, installationId);
    const outsider = await signedUpContext('outsider');

    const read = await outsider.api.get(`/api/v1/sessions/${sessionId}/share`, {
      failOnStatusCode: false,
    });
    await expectProblemDocument(read, { status: 404, code: 'SESSIONS_001' });
    const put = await outsider.api.put(`/api/v1/sessions/${sessionId}/share`, {
      data: { audience: 'link', access: 'read', lifetime: '24h' },
      failOnStatusCode: false,
    });
    await expectProblemDocument(put, { status: 404, code: 'SESSIONS_001' });

    // A link only watches; write access names people and ends within a day.
    for (const data of [
      { audience: 'link', access: 'write', lifetime: '1h' },
      { audience: 'people', access: 'write', people: ['a@example.com'], lifetime: '7d' },
      { audience: 'people', access: 'write', people: ['a@example.com'], lifetime: null },
    ]) {
      const refused = await owner.api.put(`/api/v1/sessions/${sessionId}/share`, {
        data,
        failOnStatusCode: false,
      });
      expect(refused.status(), JSON.stringify(data)).toBe(400);
    }

    const guest = await signedUpContext('guesser');
    const guess = await guest.api.post('/api/v1/shared-sessions/lookup', {
      data: { slug: 'A'.repeat(22) },
      failOnStatusCode: false,
    });
    await expectProblemDocument(guess, { status: 404, code: 'SESSIONS_021' });
  });
});
