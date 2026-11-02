import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CursorCloudAgentsGateway, keyBucket } from '../cursor-cloud-agents.gateway';

/**
 * Cursor's gateway against a `fetch` double: what a launch sends (Basic auth
 * on the person's key, our id as Cursor's agent id), how Cursor's answers
 * read in our words (a run's status, branch, pull request and reply), how
 * its refusals map onto the module's codes, and that a refusal for rate is
 * `CLOUD_AGENTS_007` and pauses the next call without reaching the network
 * (`.agents/rules/integrations.md`).
 */

const ACCESS = { apiKey: 'crsr_placeholder_key', bucket: 'user:42' };
const AGENT_ID = '7f1c2d9e-0000-4000-8000-000000000001';

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function gateway(): CursorCloudAgentsGateway {
  const config = {
    getOrThrow: () => 'https://cursor.test/',
  } as unknown as ConfigService;
  return new CursorCloudAgentsGateway(config);
}

function stubFetch(...answers: Response[]) {
  const fetch = vi.fn();
  for (const answer of answers) fetch.mockResolvedValueOnce(answer);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe('CursorCloudAgentsGateway', () => {
  it('launches on the person’s key, naming the agent with our id, and reads back its first run', async () => {
    const fetch = stubFetch(
      json(201, {
        agent: {
          id: `bc-${AGENT_ID}`,
          name: 'Fix the login page',
          url: 'https://cursor.com/agents/bc-1',
          latestRunId: 'run-1',
        },
        run: { id: 'run-1', status: 'CREATING' },
      }),
    );

    const launched = await gateway().launch(ACCESS, {
      agentId: AGENT_ID,
      prompt: 'Fix the login page',
      repositoryUrl: 'https://github.com/acme/api',
      startingRef: 'main',
      model: 'grok-4.7',
    });

    expect(launched).toEqual({
      agentId: `bc-${AGENT_ID}`,
      name: 'Fix the login page',
      url: 'https://cursor.com/agents/bc-1',
      runId: 'run-1',
      status: 'starting',
      branch: null,
      pullRequestUrl: null,
      summary: null,
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://cursor.test/v1/agents');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe(
      `Basic ${Buffer.from('crsr_placeholder_key:').toString('base64')}`,
    );
    expect(JSON.parse(init.body)).toEqual({
      agentId: `bc-${AGENT_ID}`,
      prompt: { text: 'Fix the login page' },
      model: { id: 'grok-4.7' },
      repos: [{ url: 'https://github.com/acme/api', startingRef: 'main' }],
      // The session's branch is the product's: no pull request from Cursor.
      autoCreatePR: false,
    });
  });

  it('leaves the model and the starting ref out when none is asked for, so Cursor picks its defaults', async () => {
    const fetch = stubFetch(
      json(201, { agent: { id: 'bc-1' }, run: { id: 'run-1', status: 'CREATING' } }),
    );
    await gateway().launch(ACCESS, {
      agentId: AGENT_ID,
      prompt: 'Go',
      repositoryUrl: 'https://github.com/acme/api',
      startingRef: null,
      model: null,
    });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('model');
    expect(body.repos).toEqual([{ url: 'https://github.com/acme/api' }]);
  });

  it('reads a finished run’s branch, pull request and reply, and a status it does not know as running', async () => {
    stubFetch(
      json(200, {
        id: 'run-1',
        status: 'FINISHED',
        result: 'Fixed it.',
        git: {
          branches: [
            {
              repoUrl: 'github.com/acme/api',
              branch: 'cursor/fix-login',
              prUrl: 'https://github.com/acme/api/pull/7',
            },
          ],
        },
      }),
      json(200, { id: 'run-2', status: 'SOMETHING_NEW' }),
    );
    await expect(gateway().read(ACCESS, 'bc-1', 'run-1')).resolves.toEqual({
      runId: 'run-1',
      status: 'finished',
      branch: 'cursor/fix-login',
      pullRequestUrl: 'https://github.com/acme/api/pull/7',
      summary: 'Fixed it.',
    });
    await expect(gateway().read(ACCESS, 'bc-1', 'run-2')).resolves.toMatchObject({
      status: 'running',
    });
  });

  it('maps Cursor’s refusals onto the module’s codes, keeping its words and its code', async () => {
    const cases: [Response, string][] = [
      [json(401, { code: 'error', message: 'Invalid User API Key' }), 'CLOUD_AGENTS_005'],
      [
        json(402, { error: { code: 'usage_limit_exceeded', message: 'Out of usage' } }),
        'CLOUD_AGENTS_010',
      ],
      [json(400, { error: { code: 'validation_error', message: 'Required' } }), 'CLOUD_AGENTS_010'],
      [json(500, { error: { code: 'internal', message: 'oops' } }), 'CLOUD_AGENTS_006'],
    ];
    for (const [answer, code] of cases) {
      stubFetch(answer);
      await expect(gateway().read(ACCESS, 'bc-1', 'run-1')).rejects.toMatchObject({ code });
    }
    stubFetch(json(400, { error: { code: 'validation_error', message: 'Required' } }));
    await expect(gateway().read(ACCESS, 'bc-1', 'run-1')).rejects.toMatchObject({
      detail: 'Cursor: Required',
      extensions: { upstreamCode: 'validation_error' },
    });
  });

  it('answers an unreachable Cursor as CLOUD_AGENTS_006', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(gateway().read(ACCESS, 'bc-1', 'run-1')).rejects.toMatchObject({
      code: 'CLOUD_AGENTS_006',
    });
  });

  it('answers a rate limit with CLOUD_AGENTS_007 and pauses the next call without asking Cursor', async () => {
    const fetch = stubFetch(
      json(
        429,
        { error: { code: 'rate_limit_exceeded', message: 'slow down' } },
        {
          'retry-after': '30',
        },
      ),
    );
    const cursor = gateway();
    await expect(cursor.read(ACCESS, 'bc-1', 'run-1')).rejects.toMatchObject({
      code: 'CLOUD_AGENTS_007',
    });
    await expect(cursor.read(ACCESS, 'bc-1', 'run-1')).rejects.toMatchObject({
      code: 'CLOUD_AGENTS_007',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    // Another person's bucket is not paused.
    fetch.mockResolvedValueOnce(json(200, { id: 'run-1', status: 'RUNNING' }));
    await expect(
      cursor.read({ ...ACCESS, bucket: 'user:43' }, 'bc-1', 'run-1'),
    ).resolves.toMatchObject({ status: 'running' });
  });

  it('lists models without Cursor’s own default, which a launch names no model for', async () => {
    stubFetch(
      json(200, {
        items: [
          { id: 'default', displayName: 'Auto' },
          { id: 'grok-4.7', displayName: 'Grok 4.7' },
          { id: 'composer-2' },
        ],
      }),
    );
    await expect(gateway().models(ACCESS)).resolves.toEqual([
      { id: 'grok-4.7', label: 'Grok 4.7' },
      { id: 'composer-2', label: 'composer-2' },
    ]);
  });

  it('says whose a key is, bucketing the question by a digest of the key, never the key', async () => {
    const fetch = stubFetch(
      json(200, { apiKeyName: 'Laptop', userId: 184, userEmail: 'ana@example.com' }),
    );
    await expect(gateway().me('crsr_new_key')).resolves.toEqual({
      keyName: 'Laptop',
      userId: '184',
      email: 'ana@example.com',
    });
    expect(fetch.mock.calls[0][0]).toBe('https://cursor.test/v1/me');
    expect(keyBucket('crsr_new_key')).toMatch(/^key:[0-9a-f]{16}$/);
    expect(keyBucket('crsr_new_key')).not.toContain('crsr');
  });
});
