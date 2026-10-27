import { expect, test } from '@playwright/test';
import { REFUSE_MARKER, STUB_KEY_PREFIX } from '../../support/cursor-stub';
import { provisionedUser } from '../../support/web';

/**
 * Cloud agents against the real control plane, on the Cursor stub
 * (`support/cursor-stub.ts`): a person connects their own Cursor key, which
 * is checked with Cursor before it is kept and never read back; launches an
 * agent; watches its run play out; follows up once it has finished; and stops
 * one. Nobody else sees the key or the agents. The
 * gateway's own spec covers Cursor's shapes; this proves the routes, the
 * registry wiring and the sealed key together.
 */

const KEY = `${STUB_KEY_PREFIX}9f3a`;
const LAUNCH = {
  provider: 'cursor',
  prompt: 'Fix the login redirect loop. Keep the change small.',
  repositoryUrl: 'https://github.com/acme/api',
  model: 'grok-4.7',
};

test.describe('Cloud agents', () => {
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

  test('launches an agent, follows its run to the end, then gives it its next instruction', async () => {
    const owner = await provisionedUser('cloud-launch');
    await owner.api.put('/api/v1/cloud-agents/providers/cursor/credential', {
      data: { apiKey: KEY },
    });

    const launched = await owner.api.post('/api/v1/cloud-agents', { data: LAUNCH });
    expect(launched.status(), await launched.text()).toBe(201);
    const agent = await launched.json();
    expect(agent).toMatchObject({
      provider: 'cursor',
      externalId: `bc-${agent.id}`,
      status: 'starting',
      model: 'grok-4.7',
      repositoryUrl: 'https://github.com/acme/api',
    });

    const list = await owner.api.get('/api/v1/cloud-agents');
    expect((await list.json()).map((row: { id: string }) => row.id)).toEqual([agent.id]);

    // The stub's run finishes after a few seconds; the API reads it through.
    await expect
      .poll(
        async () => (await (await owner.api.get(`/api/v1/cloud-agents/${agent.id}`)).json()).status,
        { timeout: 40_000, intervals: [2_000] },
      )
      .toBe('finished');
    const finished = await (await owner.api.get(`/api/v1/cloud-agents/${agent.id}`)).json();
    expect(finished.branch).toMatch(/^cursor\//);
    expect(finished.summary).toContain('Fix the login redirect loop');

    const followed = await owner.api.post(`/api/v1/cloud-agents/${agent.id}/follow-ups`, {
      data: { prompt: 'Add a test for it.' },
    });
    expect(followed.status(), await followed.text()).toBe(200);
    expect(await followed.json()).toMatchObject({ status: 'starting', summary: null });

    const busy = await owner.api.post(`/api/v1/cloud-agents/${agent.id}/follow-ups`, {
      data: { prompt: 'And another.' },
    });
    expect(busy.status()).toBe(409);
    expect(await busy.json()).toMatchObject({ code: 'CLOUD_AGENTS_008' });

    const stranger = await provisionedUser('cloud-launch-stranger');
    const hidden = await stranger.api.get(`/api/v1/cloud-agents/${agent.id}`);
    expect(hidden.status()).toBe(404);
    expect(await hidden.json()).toMatchObject({ code: 'CLOUD_AGENTS_001' });
  });

  test('stops a working agent, and says why when Cursor refuses a launch', async () => {
    const owner = await provisionedUser('cloud-stop');
    await owner.api.put('/api/v1/cloud-agents/providers/cursor/credential', {
      data: { apiKey: KEY },
    });

    const agent = await (await owner.api.post('/api/v1/cloud-agents', { data: LAUNCH })).json();
    const stopped = await owner.api.post(`/api/v1/cloud-agents/${agent.id}/cancel`);
    expect(stopped.status(), await stopped.text()).toBe(200);
    expect(await stopped.json()).toMatchObject({ status: 'cancelled' });

    const again = await owner.api.post(`/api/v1/cloud-agents/${agent.id}/cancel`);
    expect(again.status()).toBe(409);
    expect(await again.json()).toMatchObject({ code: 'CLOUD_AGENTS_009' });

    const refused = await owner.api.post('/api/v1/cloud-agents', {
      data: { ...LAUNCH, prompt: `Do it ${REFUSE_MARKER}` },
    });
    expect(refused.status()).toBe(422);
    expect(await refused.json()).toMatchObject({
      code: 'CLOUD_AGENTS_010',
      detail: 'Cursor: Repository is not accessible',
    });
    const list = await (await owner.api.get('/api/v1/cloud-agents')).json();
    expect(list).toHaveLength(1);
  });

  test('refuses a launch before a key is connected', async () => {
    const owner = await provisionedUser('cloud-unconnected');
    const response = await owner.api.post('/api/v1/cloud-agents', { data: LAUNCH });
    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'CLOUD_AGENTS_004' });
  });
});
