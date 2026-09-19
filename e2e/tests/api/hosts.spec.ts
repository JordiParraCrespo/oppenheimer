import { createHash, generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import { type APIRequestContext, expect, request, test } from '@playwright/test';
import { API_URL } from '../../playwright.config';
import { expectProblemDocument, newContext, signedUpContext } from '../../support/auth';

/**
 * Pairing a machine, driven the way a machine drives it.
 *
 * The console mints a token; a "runner" — a generated Ed25519 keypair and the
 * two HTTP calls the real one makes — redeems it and later says it is gone. The
 * point of doing it here rather than only in the integration suite is that these
 * requests go through the deployed pipeline: the global guards, the credential
 * resolver and the problem-document filter all have to agree that a host is a
 * principal with no person behind it.
 *
 * Skipped when the deployment has no runner release configured: without it
 * pairing answers `HOSTS_004` by design, and a red test would be reporting the
 * configuration rather than the code.
 */

/** A machine's keypair, encoded the way the runner encodes it. */
function hostKey() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
  return {
    privateKey,
    base64: raw.toString('base64'),
    fingerprint: createHash('sha256').update(raw).digest('hex'),
  };
}

/** The short-lived boot assertion the runner signs on every dial. */
function bootAssertion(privateKey: KeyObject, hostId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: hostId,
      sub: hostId,
      aud: API_URL,
      jti: createHash('sha256').update(`${hostId}:${Math.random()}`).digest('hex').slice(0, 32),
      iat: now,
      exp: now + 300,
    }),
  ).toString('base64url');
  const signature = sign(null, Buffer.from(`${header}.${payload}`), privateKey);
  return `${header}.${payload}.${signature.toString('base64url')}`;
}

/** A context that authenticates purely as a host, with its own assertion. */
async function hostContext(assertion: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${assertion}`, Origin: 'http://localhost:3000' },
  });
}

/** Mint a pairing token and pull the secret out of the install command. */
async function mintPairingToken(api: APIRequestContext, name = 'e2e box') {
  const response = await api.post('/api/v1/hosts/pairing', {
    data: { name },
    failOnStatusCode: false,
  });
  const body = await response.json().catch(() => ({}));
  return {
    status: response.status(),
    id: (body as { id?: string }).id,
    secret: /--token (\S+)/.exec((body as { installCommand?: string }).installCommand ?? '')?.[1],
    body,
  };
}

const FACTS = {
  hostname: 'e2e-box.local',
  os: 'linux',
  arch: 'amd64',
  tools: { git: '2.51.0', tmux: '3.5a' },
  agents: [],
};

test.describe('Hosts', () => {
  test('a machine pairs, appears online-aware, and unpairs itself', async () => {
    const { api, userId } = await signedUpContext('hostowner');

    const minted = await mintPairingToken(api, 'Pairing flow');
    test.skip(
      minted.status === 503,
      'this deployment has no runner release configured (HOSTS_004)',
    );
    expect(minted.status, JSON.stringify(minted.body)).toBe(201);
    expect(minted.secret, 'the secret is returned once, inside the install command').toMatch(
      /^opr_reg_/,
    );

    // The runner's first HTTP call: no credential but the token itself.
    const key = hostKey();
    const anonymous = await newContext();
    const registered = await anonymous.post('/api/v1/hosts/register', {
      data: { token: minted.secret, name: 'detected-name', publicKey: key.base64, facts: FACTS },
      failOnStatusCode: false,
    });
    expect(registered.status(), await registered.text()).toBe(201);
    const { hostId, fingerprint } = await registered.json();
    expect(hostId).toBeTruthy();
    // The control plane's own key, which the runner pins from here on.
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);

    const listed = await api.get('/api/v1/hosts', { failOnStatusCode: false });
    expect(listed.status()).toBe(200);
    const hosts = (await listed.json()) as Record<string, unknown>[];
    const mine = hosts.find((host) => host.id === hostId);
    expect(mine).toBeDefined();
    expect(mine).toMatchObject({
      // The token named the machine before it existed; the runner's detected
      // name is not what a person sees.
      name: 'Pairing flow',
      ownerUserId: userId,
      publicKeyFingerprint: key.fingerprint,
      online: false,
    });

    // The runner's second and last HTTP call, authenticated by a signed
    // assertion rather than by the spent token.
    const asHost = await hostContext(bootAssertion(key.privateKey, hostId));
    const uninstalled = await asHost.delete('/api/v1/hosts/self', { failOnStatusCode: false });
    expect(uninstalled.status()).toBe(204);

    const after = await api.get(`/api/v1/hosts/${hostId}`, { failOnStatusCode: false });
    expect(after.status()).toBe(200);
    expect((await after.json()).unpairedAt, 'the row is kept, not deleted').toBeTruthy();
  });

  test('a host credential cannot reach a route meant for a person', async () => {
    const { api } = await signedUpContext('hostscope');
    const minted = await mintPairingToken(api);
    test.skip(minted.status === 503, 'this deployment has no runner release configured');

    const key = hostKey();
    const anonymous = await newContext();
    const registered = await anonymous.post('/api/v1/hosts/register', {
      data: { token: minted.secret, name: 'scoped', publicKey: key.base64, facts: FACTS },
      failOnStatusCode: false,
    });
    const { hostId } = await registered.json();

    const asHost = await hostContext(bootAssertion(key.privateKey, hostId));
    const listed = await asHost.get('/api/v1/hosts', { failOnStatusCode: false });

    // A machine holds no permissions of its own, so every route that asks for a
    // scope refuses it.
    await expectProblemDocument(listed, { status: 403, code: 'TOKEN_005' });
  });

  test('a session cookie cannot call the host-only route', async () => {
    const { api } = await signedUpContext('hostself');

    const refused = await api.delete('/api/v1/hosts/self', { failOnStatusCode: false });

    await expectProblemDocument(refused, { status: 401, code: 'HOSTS_005' });
  });

  test('a made-up registration token is refused, and says no more than that', async () => {
    const anonymous = await newContext();

    const registered = await anonymous.post('/api/v1/hosts/register', {
      data: {
        token: 'opr_reg_totally-made-up-secret-0123456789',
        name: 'nobody',
        publicKey: hostKey().base64,
        facts: FACTS,
      },
      failOnStatusCode: false,
    });

    // Used, expired, revoked and never-real share one answer on purpose.
    const problem = await registered.json();
    expect(registered.status()).toBe(401);
    expect(problem.code).toBe('HOSTS_003');
  });

  test('an anonymous caller cannot mint a pairing token', async () => {
    const api = await newContext();

    const minted = await mintPairingToken(api);

    expect(minted.status).toBe(401);
  });

  test("a user cannot see another user's hosts", async () => {
    const { api: owner } = await signedUpContext('hostvictim');
    const minted = await mintPairingToken(owner, 'victim box');
    test.skip(minted.status === 503, 'this deployment has no runner release configured');

    const key = hostKey();
    const anonymous = await newContext();
    const registered = await anonymous.post('/api/v1/hosts/register', {
      data: { token: minted.secret, name: 'victim', publicKey: key.base64, facts: FACTS },
      failOnStatusCode: false,
    });
    const { hostId } = await registered.json();

    const { api: attacker } = await signedUpContext('hostattacker');
    const listed = await attacker.get('/api/v1/hosts', { failOnStatusCode: false });
    expect(listed.status()).toBe(200);
    const rows = (await listed.json()) as { id: string }[];
    expect(
      rows.some((row) => row.id === hostId),
      'a host belongs to the person who paired it, so nobody else lists it',
    ).toBe(false);

    // And the detail route agrees with the list rather than confirming the id.
    const detail = await attacker.get(`/api/v1/hosts/${hostId}`, { failOnStatusCode: false });
    await expectProblemDocument(detail, { status: 404, code: 'HOSTS_001' });
  });
});
