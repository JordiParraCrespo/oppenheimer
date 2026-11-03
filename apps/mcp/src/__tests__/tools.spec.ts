import { describe, expect, it, vi } from 'vitest';
import { OppenheimerClient } from '../client';
import { waitForTurn } from '../tools/bots.tools';
import { promptInput, sessionBody, waitForSession } from '../tools/sessions.tools';

/**
 * What an agent on one host needs to hand work to another: a session started
 * in the right repository on the right host, and a wait that returns when the
 * helper is through or needs somebody rather than holding the call for ever.
 */

const PROJECT = {
  id: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  defaultHostId: 'host-default',
  defaultAgent: 'codex',
  repositories: [
    {
      installationId: 'inst-1',
      githubRepoId: '11',
      repositoryFullName: 'acme/web',
      baseBranch: 'main',
      isDefault: false,
    },
    {
      installationId: 'inst-1',
      githubRepoId: '22',
      repositoryFullName: 'acme/api',
      baseBranch: 'trunk',
      isDefault: true,
    },
  ],
};

describe('sessionBody', () => {
  it('runs on the project’s default host, agent and repository when none is named', () => {
    expect(sessionBody({ task: 'fix it', project: PROJECT })).toEqual({
      hostId: 'host-default',
      agent: 'codex',
      projectId: PROJECT.id,
      name: undefined,
      prompt: 'fix it',
      checkouts: [{ installationId: 'inst-1', githubRepoId: 22, baseBranch: 'trunk' }],
      cwdGithubRepoId: 22,
    });
  });

  it('checks out the repository it names, whatever its case', () => {
    const body = sessionBody({ task: 'fix it', project: PROJECT, repository: 'ACME/web' });
    expect(body.checkouts).toEqual([
      { installationId: 'inst-1', githubRepoId: 11, baseBranch: 'main' },
    ]);
  });

  it('refuses a repository the project does not hold, saying where to look', () => {
    expect(() => sessionBody({ task: 't', project: PROJECT, repository: 'acme/docs' })).toThrow(
      /list_projects/,
    );
  });

  it('refuses to guess a host when neither the call nor the project names one', () => {
    expect(() => sessionBody({ task: 't', project: { ...PROJECT, defaultHostId: null } })).toThrow(
      /list_hosts/,
    );
  });

  it('runs in a folder on the host with no project at all', () => {
    expect(sessionBody({ task: 't', host_id: 'h-1', folder: '/srv/app' })).toMatchObject({
      hostId: 'h-1',
      folder: '/srv/app',
      agent: 'claude-code',
    });
  });
});

describe('promptInput', () => {
  it('holds a prompt to the API’s byte bound, not a character count', () => {
    const schema = promptInput('A task.');
    expect(schema.safeParse('a'.repeat(2048)).success).toBe(true);
    // 700 three-byte characters are 2100 bytes: fewer characters than the
    // bound, more bytes, which the API would refuse.
    expect(schema.safeParse('€'.repeat(700)).success).toBe(false);
  });
});

const clientAnswering = (answer: (path: string) => unknown) =>
  new OppenheimerClient({
    apiUrl: 'https://api.example.com',
    token: 't',
    fetchImpl: vi.fn(async (url: string) =>
      Response.json(answer(new URL(url).pathname.replace('/api/v1', ''))),
    ) as unknown as typeof fetch,
  });

describe('waitForSession', () => {
  it('returns the session once it settles', async () => {
    const states = ['working', 'ready-for-review'];
    const client = clientAnswering(() => ({ id: 's', lifecycle: 'open', state: states.shift() }));

    const result = await waitForSession(client, 's', 60, undefined, async () => {});

    expect(result).toEqual({
      settled: true,
      session: { id: 's', lifecycle: 'open', state: 'ready-for-review' },
    });
  });

  it('answers unsettled, without sleeping, when there is no time to wait', async () => {
    const client = clientAnswering(() => ({ id: 's', lifecycle: 'open', state: 'working' }));
    const sleep = vi.fn(async () => {});

    const result = await waitForSession(client, 's', 0, undefined, sleep);

    expect(result.settled).toBe(false);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('waitForSession after a prompt', () => {
  it('keeps waiting on an idle session until the log shows the agent took the prompt', async () => {
    // Codex's review of #618: `send_to_session` leaves the session idle until
    // the agent is seen on it, and the wait used to answer "settled" there.
    const logs = [[], [{ seq: 8, kind: 'agent.observed', payload: { state: 'working' } }]];
    let sessionReads = 0;
    const client = clientAnswering((path) => {
      if (path.endsWith('/events')) return { data: logs.shift() ?? [], nextSeq: null };
      sessionReads += 1;
      return { id: 's', lifecycle: 'open', state: 'idle' };
    });

    const result = await waitForSession(client, 's', 60, 7, async () => {});

    expect(result).toMatchObject({ settled: true, tookWork: true });
    expect(sessionReads).toBe(2);
  });
});

describe('waitForTurn', () => {
  it('stops at an approval only the person can decide, and says what it is', async () => {
    const client = clientAnswering((path) =>
      path.endsWith('/approvals')
        ? [{ turnId: 't-1', summary: 'Start a session on mac-studio', status: 'pending' }]
        : { turns: [{ id: 't-1', status: 'running', error: null }], messages: [] },
    );

    const outcome = await waitForTurn(client, 'b-1', 't-1', 60, async () => {});

    expect(outcome.done).toBe(false);
    expect(outcome.waitingOnApproval).toEqual(['Start a session on mac-studio']);
  });

  it('returns only this turn’s replies once it completes', async () => {
    const client = clientAnswering((path) =>
      path.endsWith('/approvals')
        ? []
        : {
            turns: [{ id: 't-1', status: 'completed', error: null }],
            messages: [
              { turnId: 't-0', role: 'assistant', content: 'older' },
              { turnId: 't-1', role: 'user', content: 'question' },
              { turnId: 't-1', role: 'assistant', content: 'Two runs failed.' },
            ],
          },
    );

    const outcome = await waitForTurn(client, 'b-1', 't-1', 60, async () => {});

    expect(outcome).toMatchObject({ done: true, replies: ['Two runs failed.'] });
  });
});
