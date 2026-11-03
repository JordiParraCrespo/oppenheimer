import { SessionCloudRunEntity } from '../../../sessions/domain/session-cloud-run.entity';
import { SESSION_EVENT_KINDS } from '../../../sessions/domain/session-state.policy';
import { WorkSessionEntity } from '../../../sessions/domain/work-session.entity';
import { cloudLinkOf, describeCloudSession } from '../bot-cloud-session.policy';

/**
 * One describer for a session's cloud half, whichever kind it is: what
 * `get_session` prints and what `start_cloud_session` waits for. A host
 * session has none; a host-started cloud is linked by the id its host
 * reported; a launched one by the page its vendor gave, with the run.
 */
const base = {
  organizationId: 'org-1',
  projectId: 'project-1',
  createdByUserId: 'owner-1',
  slug: 'bold-otter-3f9a7k',
};

function hostStarted(agent: 'claude-code' | 'codex', id: string | null): WorkSessionEntity {
  const session = WorkSessionEntity.request({ ...base, hostId: 'host-1', agent, place: 'cloud' });
  if (id) {
    session.recordEvent({
      seq: 1,
      kind: SESSION_EVENT_KINDS.STARTED,
      payload: { agentSessionId: id, checkouts: [] },
      occurredAt: new Date(),
    });
  }
  return session;
}

function launched(pullRequestUrl: string | null): WorkSessionEntity {
  return WorkSessionEntity.requestCloud({
    ...base,
    id: 'session-1',
    agent: 'cursor',
    cloudRun: SessionCloudRunEntity.launched(
      {
        organizationId: 'org-1',
        sessionId: 'session-1',
        provider: 'cursor',
        externalId: 'bc-session-1',
        url: 'https://cursor.com/agents?id=bc-session-1',
        repositoryUrl: 'https://github.com/acme/xrp-mobile',
        run: { runId: 'run-1', status: 'finished', branch: null, pullRequestUrl, summary: null },
      },
      new Date(),
    ),
  });
}

describe('the cloud half of a session', () => {
  it('is nothing for a session that runs on its host', () => {
    const session = WorkSessionEntity.request({ ...base, hostId: 'host-1', agent: 'claude-code' });
    expect(cloudLinkOf(session)).toBeNull();
    expect(describeCloudSession(session)).toBeNull();
  });

  it('links a host-started cloud by the id its host reported, at its own vendor', () => {
    expect(cloudLinkOf(hostStarted('claude-code', 'session_014a8EH8DJs95X1i'))).toBe(
      'https://claude.ai/code/session_014a8EH8DJs95X1i',
    );
    expect(cloudLinkOf(hostStarted('codex', 'task_e_6823abc'))).toBe(
      'https://chatgpt.com/codex/tasks/task_e_6823abc',
    );
  });

  it('says a host-started cloud has no link until its host reports one', () => {
    expect(cloudLinkOf(hostStarted('claude-code', null))).toBeNull();
    expect(describeCloudSession(hostStarted('claude-code', null))).toBe(
      '- cloud session: no link yet',
    );
  });

  it('links a launched cloud by its vendor page, with its run and pull request', () => {
    expect(describeCloudSession(launched('https://github.com/acme/xrp-mobile/pull/7'))).toBe(
      '- cloud session: https://cursor.com/agents?id=bc-session-1 (finished, pull request https://github.com/acme/xrp-mobile/pull/7)',
    );
    expect(describeCloudSession(launched(null))).toBe(
      '- cloud session: https://cursor.com/agents?id=bc-session-1 (finished)',
    );
  });
});
