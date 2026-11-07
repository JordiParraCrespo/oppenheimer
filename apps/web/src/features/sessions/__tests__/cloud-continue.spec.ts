import { sessionCheckout, sessionEntity } from '@oppenheimer/frontend-consumer/testing';
import { describe, expect, it } from 'vitest';
import { canContinueOnHost, continueOnHost } from '../lib/cloud-continue';

/**
 * Continuing a cloud session on a host is a worktree of the repository it
 * worked on, from its base, whose agent opens the cloud session there. A
 * regression that sent a first task would ask the conversation for the work
 * a second time; one that offered it for a Codex task or a session its host
 * has not started would post a create the API refuses.
 */
function cloudSession(agent: 'claude-code' | 'codex', cloudSessionId: string | null) {
  return sessionEntity({
    name: 'Fix the wallet list empty state',
    agent,
    place: 'cloud',
    cloud: null,
    cloudSessionId,
    checkouts: [sessionCheckout({ githubRepoId: '42', repositoryFullName: 'acme/xrp-mobile' })],
  });
}

describe('continueOnHost', () => {
  it("continues Claude Code's on a host as a worktree session that teleports it", () => {
    const session = cloudSession('claude-code', 'session_014a8EH8DJs95X1iK8ZH9Y82');

    expect(canContinueOnHost(session)).toBe(true);
    expect(continueOnHost(session, 'host-2')).toEqual({
      hostId: 'host-2',
      agent: 'claude-code',
      projectId: session.projectId,
      name: 'Fix the wallet list empty state',
      checkouts: [{ installationId: 'installation-1', githubRepoId: 42, baseBranch: 'main' }],
      teleport: 'session_014a8EH8DJs95X1iK8ZH9Y82',
    });
  });

  it('continues neither a Codex task nor a session its host has not started', () => {
    expect(continueOnHost(cloudSession('codex', 'task_e_68a1b2c3d4'), 'host-2')).toBeNull();
    expect(continueOnHost(cloudSession('claude-code', null), 'host-2')).toBeNull();
  });
});
