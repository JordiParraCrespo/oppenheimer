import { type APIRequestContext, expect, test } from '@playwright/test';
import { REFUSE_MARKER, STUB_KEY_PREFIX } from '../../support/cursor-stub';
import { connectInstallation, createProject, STUB_REPOSITORIES } from '../../support/sessions';
import { provisionedUser } from '../../support/web';

/**
 * Cloud sessions against the real control plane, on the Cursor stub
 * (`support/cursor-stub.ts`): a person connects their own Cursor key, which
 * is checked with Cursor before it is kept and never read back, and starts a
 * session in Cursor's cloud on a repository of their GitHub installation. It
 * is a session like any other — listed with the rest, in its project — with
 * no host: its state follows the run Cursor reports, what only a host has is
 * refused, and closing it resolves it at once. Nobody else sees the key or
 * the session. The gateway's own spec covers Cursor's shapes; this proves the
 * routes, the registry wiring, the sealed key and the sync together.
 */

const KEY = `${STUB_KEY_PREFIX}9f3a`;
const PROMPT = 'Fix the login redirect loop. Keep the change small.';

/** A workspace ready for a cloud session: a key, an installation, a project. */
async function ready(api: APIRequestContext) {
  await api.put('/api/v1/cloud-agents/providers/cursor/credential', { data: { apiKey: KEY } });
  const installationId = await connectInstallation(api);
  const projectId = await createProject(api, installationId);
  return {
    projectId,
    body: (prompt = PROMPT) => ({
      provider: 'cursor',
      projectId,
      checkout: { installationId, githubRepoId: STUB_REPOSITORIES.mobile.githubRepoId },
      prompt,
      model: 'grok-4.7',
    }),
  };
}

test.describe('Cloud sessions', () => {
  test('connects a Cursor key only once Cursor accepts it, and never hands it back', async () => {
    const owner = await provisionedUser('cloud-key');

    const before = await owner.api.get('/api/v1/cloud-agents/status');
    expect(before.status(), await before.text()).toBe(200);
    expect(await before.json()).toMatchObject({
      configured: true,
      available: false,
      providers: [{ id: 'cursor', connected: false }],
    });

    const refused = await owner.api.put('/api/v1/cloud-agents/providers/cursor/credential', {
      data: { apiKey: 'crsr_not_a_real_key' },
    });
    expect(refused.status()).toBe(422);
    expect(await refused.json()).toMatchObject({ code: 'CLOUD_AGENTS_005' });

    const connected = await owner.api.put('/api/v1/cloud-agents/providers/cursor/credential', {
      data: { apiKey: KEY },
    });
    expect(connected.status(), await connected.text()).toBe(200);
    const status = await connected.json();
    expect(status).toMatchObject({
      available: true,
      providers: [
        {
          id: 'cursor',
          connected: true,
          keyName: 'Stub key',
          keyHint: '9f3a',
          accountEmail: 'stub@cursor.test',
        },
      ],
    });
    expect(JSON.stringify(status)).not.toContain(KEY);

    const models = await owner.api.get('/api/v1/cloud-agents/providers/cursor/models');
    expect(await models.json()).toContainEqual({ id: 'grok-4.7', label: 'Grok 4.7' });
    const repositories = await owner.api.get('/api/v1/cloud-agents/providers/cursor/repositories');
    expect(await repositories.json()).toContainEqual({ url: 'https://github.com/acme/api' });

    const stranger = await provisionedUser('cloud-key-stranger');
    const theirs = await stranger.api.get('/api/v1/cloud-agents/status');
    expect(await theirs.json()).toMatchObject({ providers: [{ connected: false }] });
  });

  test('starts a session in Cursor’s cloud that is listed with the others and follows its run', async () => {
    const owner = await provisionedUser('cloud-start');
    const { projectId, body } = await ready(owner.api);

    const started = await owner.api.post('/api/v1/sessions/cloud', {
      data: body(),
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    expect(started.status(), await started.text()).toBe(201);
    const session = await started.json();
    expect(session).toMatchObject({
      place: 'cloud',
      hostId: null,
      agent: 'cursor',
      projectId,
      launch: { model: 'grok-4.7', permission: null },
      cloud: { provider: 'cursor', status: 'starting' },
    });
    expect(session.cloud.repositoryUrl).toMatch(/\/xrp-mobile$/);
    expect(session.cloud.url).toContain(`bc-${session.id}`);

    const list = await (await owner.api.get('/api/v1/sessions')).json();
    expect(list.data.map((row: { id: string }) => row.id)).toContain(session.id);

    // The stub's run finishes after a few seconds; a read asks Cursor and the
    // log folds what it said into the session's state.
    await expect
      .poll(
        async () => {
          const read = await (await owner.api.get(`/api/v1/sessions/${session.id}`)).json();
          return [read.cloud.status, read.lifecycle, read.state];
        },
        { timeout: 40_000, intervals: [2_000] },
      )
      .toEqual(['finished', 'open', 'idle']);
    const finished = await (await owner.api.get(`/api/v1/sessions/${session.id}`)).json();
    expect(finished.cloud.branch).toMatch(/^cursor\//);

    const stranger = await provisionedUser('cloud-start-stranger');
    const hidden = await stranger.api.get(`/api/v1/sessions/${session.id}`);
    expect(hidden.status()).toBe(404);
  });

  test('refuses what only a host has, and closes at once', async () => {
    const owner = await provisionedUser('cloud-host-only');
    const { body } = await ready(owner.api);
    const session = await (await owner.api.post('/api/v1/sessions/cloud', { data: body() })).json();

    const attach = await owner.api.post(`/api/v1/sessions/${session.id}/attach-ticket`, {
      data: {},
    });
    expect(attach.status()).toBe(409);
    expect(await attach.json()).toMatchObject({ code: 'SESSIONS_036' });

    const closed = await owner.api.delete(`/api/v1/sessions/${session.id}`);
    expect(closed.status(), await closed.text()).toBeLessThan(300);
    const read = await (await owner.api.get(`/api/v1/sessions/${session.id}`)).json();
    expect(read.lifecycle).toBe('resolved');
  });

  test('says why when Cursor refuses a start, and stores nothing', async () => {
    const owner = await provisionedUser('cloud-refused');
    const { body } = await ready(owner.api);

    const refused = await owner.api.post('/api/v1/sessions/cloud', {
      data: body(`Do it ${REFUSE_MARKER}`),
    });
    expect(refused.status()).toBe(422);
    expect(await refused.json()).toMatchObject({
      code: 'CLOUD_AGENTS_010',
      detail: 'Cursor: Repository is not accessible',
    });
    const list = await (await owner.api.get('/api/v1/sessions')).json();
    expect(list.data).toHaveLength(0);
  });

  test('refuses a start before a key is connected', async () => {
    const owner = await provisionedUser('cloud-unconnected');
    const installationId = await connectInstallation(owner.api);
    const response = await owner.api.post('/api/v1/sessions/cloud', {
      data: {
        provider: 'cursor',
        checkout: { installationId, githubRepoId: STUB_REPOSITORIES.mobile.githubRepoId },
        prompt: PROMPT,
      },
    });
    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'CLOUD_AGENTS_004' });
  });
});
