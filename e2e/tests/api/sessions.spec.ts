import { createHash, generateKeyPairSync } from 'node:crypto';
import { type APIRequestContext, expect, test } from '@playwright/test';
import { expectProblemDocument, newContext, signedUpContext } from '../../support/auth';

/**
 * Sessions through the deployed pipeline.
 *
 * What this adds over the integration suite is the pipeline itself: the global
 * guards, the credential resolver, the Zod request pipe and the problem-document
 * filter all have to agree about a route whose policy is `update Session` behind
 * `sessions:write`. The state machine and the constraints are proved against a real
 * Postgres in `apps/api/test/sessions.integration.spec.ts`; what is proved here is
 * that a caller reaches them, and that another workspace does not.
 *
 * Creating a session needs a **host** and a **connected GitHub installation**, and
 * a deployment without a runner release or a GitHub App has neither by design. So
 * the create path skips when it cannot be set up, and the refusals — which need no
 * setup at all — always run.
 */

/** A machine's keypair, encoded the way the runner encodes it. */
function hostKey() {
  const { publicKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
  return {
    base64: raw.toString('base64'),
    fingerprint: createHash('sha256').update(raw).digest('hex'),
  };
}

const FACTS = {
  platform: 'linux',
  arch: 'amd64',
  hostname: 'e2e-box.local',
  user: 'runner',
  home: '/home/runner',
  root: false,
  tools: [
    { name: 'git', path: '/usr/bin/git', version: '2.51.0', required: true },
    { name: 'tmux', path: '/usr/bin/tmux', version: '3.5a', required: true },
  ],
  workspacePath: '/home/runner/oppenheimer-ai',
  diskFreeBytes: 120_000_000_000,
  runnerVersion: '0.1.0',
};

/** Pair a machine and return its id, or null when this deployment cannot pair one. */
async function pairHost(api: APIRequestContext, name: string): Promise<string | null> {
  const minted = await api.post('/api/v1/hosts/pairing', {
    data: { name },
    failOnStatusCode: false,
  });
  if (minted.status() !== 201) return null;
  const secret = /--token (\S+)/.exec((await minted.json()).installCommand ?? '')?.[1];
  if (!secret) return null;

  const anonymous = await newContext();
  const registered = await anonymous.post('/api/v1/hosts/register', {
    data: { token: secret, name, publicKey: hostKey().base64, facts: FACTS },
    failOnStatusCode: false,
  });
  if (registered.status() !== 201) return null;
  return (await registered.json()).hostId as string;
}

/** The first installation this workspace has connected, if any. */
async function anInstallation(api: APIRequestContext): Promise<string | null> {
  const listed = await api.get('/api/v1/installations', { failOnStatusCode: false });
  if (listed.status() !== 200) return null;
  const rows = (await listed.json()) as { id: string }[];
  return rows[0]?.id ?? null;
}

test.describe('Sessions', () => {
  test('a session is created, listed, stopped and keeps its log', async () => {
    const { api } = await signedUpContext('sessionowner');

    const hostId = await pairHost(api, 'Session box');
    test.skip(hostId === null, 'this deployment cannot pair a host (no runner release)');
    const installationId = await anInstallation(api);
    test.skip(
      installationId === null,
      'this deployment has no connected GitHub installation to check a repository out of',
    );

    const created = await api.post('/api/v1/sessions', {
      headers: { 'Idempotency-Key': `e2e-${Date.now()}` },
      data: {
        hostId,
        agent: 'claude-code',
        checkouts: [{ installationId, githubRepoId: 1 }],
      },
      failOnStatusCode: false,
    });
    expect(created.status(), await created.text()).toBe(201);
    const session = await created.json();

    // The slug is minted before anything is typed, because the directory and the
    // branch have to exist first; the name starts equal to it.
    expect(session.slug).toMatch(/^[a-z]+-[a-z]+-[0-9a-z]{6}$/);
    expect(session.name).toBe(session.slug);
    expect(session.lifecycle).toBe('starting');

    const listed = await api.get('/api/v1/sessions', { failOnStatusCode: false });
    expect(listed.status()).toBe(200);
    const page = await listed.json();
    expect(page.data.some((row: { id: string }) => row.id === session.id)).toBe(true);
    expect(page.meta.total).toBeGreaterThan(0);

    const stopped = await api.post(`/api/v1/sessions/${session.id}/stop`, {
      failOnStatusCode: false,
    });
    expect(stopped.status()).toBe(200);
    expect((await stopped.json()).stoppedAt, 'stopping is not closing').toBeTruthy();

    // The log is the truth per session, and `seq` is dense and the control plane's.
    const log = await api.get(`/api/v1/sessions/${session.id}/events`, { failOnStatusCode: false });
    expect(log.status()).toBe(200);
    const entries = (await log.json()).data as { seq: number; kind: string; source: string }[];
    expect(entries.map((entry) => entry.seq)).toEqual(
      Array.from({ length: entries.length }, (_, index) => index + 1),
    );
    expect(entries[0].kind).toBe('session.requested');
    expect(entries.some((entry) => entry.kind === 'session.stopped')).toBe(true);

    const closed = await api.delete(`/api/v1/sessions/${session.id}`, { failOnStatusCode: false });
    expect(closed.status()).toBe(200);
    // Never deleted: the row stays so its directory name is never reissued.
    const after = await api.get(`/api/v1/sessions/${session.id}`, { failOnStatusCode: false });
    expect(after.status()).toBe(200);
    expect((await after.json()).lifecycle).toBe('resolved');
  });

  test('an anonymous caller cannot list or create sessions', async () => {
    const api = await newContext();

    expect((await api.get('/api/v1/sessions', { failOnStatusCode: false })).status()).toBe(401);
    expect(
      (
        await api.post('/api/v1/sessions', {
          data: { hostId: crypto.randomUUID(), agent: 'claude-code', checkouts: [] },
          failOnStatusCode: false,
        })
      ).status(),
    ).toBe(401);
  });

  test('a session id nobody owns answers as missing rather than forbidden', async () => {
    const { api } = await signedUpContext('sessionprobe');

    const detail = await api.get(`/api/v1/sessions/${crypto.randomUUID()}`, {
      failOnStatusCode: false,
    });

    // Confirming the id would make this endpoint an oracle for guessing them.
    await expectProblemDocument(detail, { status: 404, code: 'SESSIONS_001' });
  });

  test('a session with no repositories must name its project', async () => {
    const { api } = await signedUpContext('sessionnoproject');

    const created = await api.post('/api/v1/sessions', {
      data: { hostId: crypto.randomUUID(), agent: 'claude-code', checkouts: [] },
      failOnStatusCode: false,
    });

    // Zero checkouts is a real session — a project of notes needs no git at all —
    // but then nothing says which project's directory it belongs in.
    expect([400, 404]).toContain(created.status());
  });

  test('a body the schema refuses never reaches a handler', async () => {
    const { api } = await signedUpContext('sessionbadbody');

    const created = await api.post('/api/v1/sessions', {
      data: { hostId: 'not-a-uuid', agent: 'not-an-agent', checkouts: [] },
      failOnStatusCode: false,
    });

    expect(created.status()).toBe(400);
  });
});
