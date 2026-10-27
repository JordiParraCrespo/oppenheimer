import { describe, expect, it } from 'vitest';
import { CloudAgentEntity, type CloudAgentRunState } from '../domain/cloud-agent.entity';
import { agentsToSync, LIST_SYNC_MAX, needsSync } from '../domain/cloud-agent-sync.policy';

/**
 * A cloud agent's state is the vendor's, copied: an answer about an older run
 * never undoes a follow-up, a branch once known is kept, and only working
 * agents heard from long enough ago are asked about again.
 */

const T0 = new Date('2026-10-26T12:00:00Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

function run(overrides: Partial<CloudAgentRunState> = {}): CloudAgentRunState {
  return {
    runId: 'run-1',
    status: 'starting',
    branch: null,
    pullRequestUrl: null,
    summary: null,
    ...overrides,
  };
}

function launched(overrides: Partial<Parameters<typeof CloudAgentEntity.launched>[0]> = {}) {
  return CloudAgentEntity.launched(
    {
      id: CloudAgentEntity.newId(),
      organizationId: 'org-1',
      createdByUserId: 'user-1',
      provider: 'cursor',
      prompt: 'Fix the login page',
      repositoryUrl: 'https://github.com/acme/api',
      startingRef: null,
      model: null,
      autoCreatePr: false,
      externalId: 'bc-1',
      url: null,
      name: 'Fix the login page',
      run: run(),
      ...overrides,
    },
    T0,
  );
}

describe('CloudAgentEntity', () => {
  it('copies the vendor’s answer about its latest run, keeping a branch the answer leaves out', () => {
    const agent = launched();
    agent.sync(run({ status: 'running', branch: 'cursor/fix-login' }), at(10));
    agent.sync(run({ status: 'finished', summary: 'Done.' }), at(20));

    expect(agent.status).toBe('finished');
    expect(agent.branch).toBe('cursor/fix-login');
    expect(agent.summary).toBe('Done.');
    expect(agent.syncedAt).toEqual(at(20));
    expect(agent.isActive).toBe(false);
  });

  it('ignores an answer about an older run, so a sync that left before a follow-up cannot undo it', () => {
    const agent = launched({ run: run({ status: 'finished', summary: 'First.' }) });
    agent.followedUp('run-2', at(5));
    agent.sync(run({ runId: 'run-1', status: 'finished', summary: 'First.' }), at(6));

    expect(agent.latestRunId).toBe('run-2');
    expect(agent.status).toBe('starting');
    expect(agent.summary).toBeNull();
  });

  it('shows a stop at once, ahead of the vendor’s next answer', () => {
    const agent = launched({ run: run({ status: 'running' }) });
    agent.cancelled(at(3));
    expect(agent.status).toBe('cancelled');
    expect(needsSync(agent, at(3600), 0)).toBe(false);
  });
});

describe('cloud agent sync policy', () => {
  it('asks again only about a working agent heard from long enough ago', () => {
    const agent = launched({ run: run({ status: 'running' }) });
    expect(needsSync(agent, at(9), 10_000)).toBe(false);
    expect(needsSync(agent, at(10), 10_000)).toBe(true);
    expect(needsSync(launched({ run: run({ status: 'failed' }) }), at(600), 10_000)).toBe(false);
  });

  it('has a list ask about the stalest working agents first, and only a few', () => {
    const agents = [40, 90, 31, 120, 60].map((ago) => {
      const agent = launched({ run: run({ status: 'running' }) });
      agent.sync(run({ status: 'running' }), at(-ago));
      return agent;
    });
    const ended = launched({ run: run({ status: 'finished' }) });

    const picked = agentsToSync([...agents, ended], at(0));
    expect(picked).toHaveLength(LIST_SYNC_MAX);
    expect(picked.map((agent) => agent.syncedAt)).toEqual([at(-120), at(-90), at(-60)]);
  });
});
