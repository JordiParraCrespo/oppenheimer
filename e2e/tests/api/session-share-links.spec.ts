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
 * Share links through the deployed pipeline: a member makes one, and a
 * holder — signed out, signed in elsewhere, or named on the link — opens it
 * through the two `shared-sessions` routes, which take the secret in the body
 * and the caller as `OptionalApiAuthGuard` finds them.
 *
 * Who a link opens for is proved on the aggregate
 * (`session-share-link.entity.spec.ts`), and what the relay does with a
 * ticket minted through one in `relay.gateways.spec.ts`; what is proved here
 * is that the guards, the schema and the error filter agree with them.
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

async function sharedSession() {
  const sessionId = await createSession(owner.api, hostId, installationId);
  return { owner, sessionId };
}

async function share(
  owner: Awaited<ReturnType<typeof signedUpContext>>,
  sessionId: string,
  data: Record<string, unknown>,
) {
  const created = await owner.api.post(`/api/v1/sessions/${sessionId}/share-links`, {
    data,
    failOnStatusCode: false,
  });
  expect(created.status(), await created.text()).toBe(201);
  return (await created.json()) as { id: string; token: string; access: string; live: boolean };
}

test.describe('Session share links', () => {
  test('a link for anyone opens signed out, mints a ticket, and opens nothing once revoked', async () => {
    test.slow();
    const { owner, sessionId } = await sharedSession();
    const link = await share(owner, sessionId, {
      access: 'read',
      audience: 'anyone',
      lifetime: '1h',
    });
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(link).toMatchObject({ access: 'read', live: true });

    // The list never carries the secret again.
    const listed = await owner.api.get(`/api/v1/sessions/${sessionId}/share-links`, {
      failOnStatusCode: false,
    });
    expect(listed.status()).toBe(200);
    const rows = (await listed.json()) as Record<string, unknown>[];
    expect(rows.map((row) => row.id)).toContain(link.id);
    expect(JSON.stringify(rows)).not.toContain(link.token);

    const stranger = await newContext();
    const lookup = await stranger.post('/api/v1/shared-sessions/lookup', {
      data: { token: link.token },
      failOnStatusCode: false,
    });
    expect(lookup.status(), await lookup.text()).toBe(200);
    expect(await lookup.json()).toMatchObject({ access: 'read', state: 'live' });

    const ticket = await stranger.post('/api/v1/shared-sessions/attach-ticket', {
      data: { token: link.token },
      failOnStatusCode: false,
    });
    expect(ticket.status(), await ticket.text()).toBe(201);
    expect(await ticket.json()).toMatchObject({ url: '/api/v1/relay/attach', window: 0 });

    const revoked = await owner.api.delete(`/api/v1/sessions/${sessionId}/share-links/${link.id}`, {
      failOnStatusCode: false,
    });
    expect(revoked.status()).toBe(204);

    const after = await stranger.post('/api/v1/shared-sessions/attach-ticket', {
      data: { token: link.token },
      failOnStatusCode: false,
    });
    await expectProblemDocument(after, { status: 404, code: 'SESSIONS_021' });
  });

  test('a link for accounts asks a signed-out holder to sign in, and opens for anyone signed in', async () => {
    test.slow();
    const { owner, sessionId } = await sharedSession();
    const link = await share(owner, sessionId, { access: 'write', audience: 'accounts' });

    const signedOut = await newContext();
    const refused = await signedOut.post('/api/v1/shared-sessions/lookup', {
      data: { token: link.token },
      failOnStatusCode: false,
    });
    await expectProblemDocument(refused, { status: 401, code: 'SESSIONS_022' });

    // Signed in to a workspace of their own, which is not the session's.
    const other = await signedUpContext('holder');
    const opened = await other.api.post('/api/v1/shared-sessions/lookup', {
      data: { token: link.token },
      failOnStatusCode: false,
    });
    expect(opened.status(), await opened.text()).toBe(200);
    expect(await opened.json()).toMatchObject({ access: 'write' });

    // A link is no way into the session itself: the members' routes still
    // answer the holder as they answer anyone outside the workspace.
    const direct = await other.api.post(`/api/v1/sessions/${sessionId}/attach-ticket`, {
      data: {},
      failOnStatusCode: false,
    });
    await expectProblemDocument(direct, { status: 404, code: 'SESSIONS_001' });
  });

  test('a link for named people opens only for a verified email on its list', async () => {
    test.slow();
    const { owner, sessionId } = await sharedSession();
    const invited = await signedUpContext('invited');
    const uninvited = await signedUpContext('uninvited');
    const link = await share(owner, sessionId, {
      access: 'read',
      audience: 'people',
      people: [invited.user.email.toUpperCase()],
    });

    // Signed up, never verified: an address anybody could have typed.
    const unverified = await invited.api.post('/api/v1/shared-sessions/lookup', {
      data: { token: link.token },
      failOnStatusCode: false,
    });
    await expectProblemDocument(unverified, { status: 403, code: 'SESSIONS_023' });

    // Verified, and signed in afresh so the session carries the account as it now is.
    await query(`UPDATE "user" SET "emailVerified" = true WHERE "id" = $1`, [invited.userId]);
    const verified = await newContext();
    expect((await signIn(verified, invited.user.email, VALID_PASSWORD)).status()).toBe(200);
    const opened = await verified.post('/api/v1/shared-sessions/lookup', {
      data: { token: link.token },
      failOnStatusCode: false,
    });
    expect(opened.status(), await opened.text()).toBe(200);

    const notListed = await uninvited.api.post('/api/v1/shared-sessions/lookup', {
      data: { token: link.token },
      failOnStatusCode: false,
    });
    await expectProblemDocument(notListed, { status: 403, code: 'SESSIONS_023' });
  });

  test('only the session’s workspace sees or makes its links, and a made-up secret opens nothing', async () => {
    test.slow();
    const { sessionId } = await sharedSession();
    const outsider = await signedUpContext('outsider');

    const list = await outsider.api.get(`/api/v1/sessions/${sessionId}/share-links`, {
      failOnStatusCode: false,
    });
    await expectProblemDocument(list, { status: 404, code: 'SESSIONS_001' });
    const make = await outsider.api.post(`/api/v1/sessions/${sessionId}/share-links`, {
      data: { access: 'write', audience: 'anyone', lifetime: '1d' },
      failOnStatusCode: false,
    });
    await expectProblemDocument(make, { status: 404, code: 'SESSIONS_001' });

    // A link that lets anyone type expires within seven days, enforced by the API.
    const owned = await sharedSession();
    for (const lifetime of [null, '30d']) {
      const refused = await owned.owner.api.post(
        `/api/v1/sessions/${owned.sessionId}/share-links`,
        { data: { access: 'write', audience: 'anyone', lifetime }, failOnStatusCode: false },
      );
      expect(refused.status(), `lifetime ${lifetime}`).toBe(400);
    }

    const guess = await (await newContext()).post('/api/v1/shared-sessions/lookup', {
      data: { token: 'A'.repeat(43) },
      failOnStatusCode: false,
    });
    await expectProblemDocument(guess, { status: 404, code: 'SESSIONS_021' });
  });
});
