import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { RecordCloudStatusCommand } from '../record-cloud-status.command';
import { RecordCloudStatusCommandHandler } from '../record-cloud-status.command-handler';

/**
 * The extension reports every minute; the log takes what is new. A cloud
 * session's state is drawn by the same observed vocabulary as any other.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};
const CLOUD_ID = 'session_014a8EH8DJs95X1iK8ZH9Y82';

function startedCloudSession(): WorkSessionEntity {
  const session = WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
    cloud: true,
  });
  session.recordEvent({
    seq: 1,
    kind: SESSION_EVENT_KINDS.STARTED,
    payload: { agentSessionId: CLOUD_ID, checkouts: [] },
    occurredAt: new Date(),
  });
  return session;
}

describe('RecordCloudStatusCommandHandler', () => {
  let session: WorkSessionEntity;
  let sessions: {
    findCloudByCloudIds: ReturnType<typeof vi.fn>;
    appendEvents: ReturnType<typeof vi.fn>;
  };
  let handler: RecordCloudStatusCommandHandler;

  beforeEach(() => {
    session = startedCloudSession();
    sessions = {
      findCloudByCloudIds: vi.fn().mockResolvedValue([session]),
      appendEvents: vi
        .fn()
        .mockImplementation(
          async (target: WorkSessionEntity, events: { kind: string; payload: unknown }[]) => {
            for (const [index, event] of events.entries()) {
              target.recordEvent({
                seq: 10 + index,
                kind: event.kind,
                payload: event.payload,
                occurredAt: new Date(),
              });
            }
          },
        ),
    };
    handler = new RecordCloudStatusCommandHandler(sessions as unknown as WorkSessionRepositoryPort);
  });

  const report = (state: 'running' | 'needs-input' | 'failed' | 'done' | 'stopped') =>
    handler.execute(
      new RecordCloudStatusCommand({
        scope: SCOPE,
        report: { sessions: [{ cloudSessionId: CLOUD_ID, state }] },
      }),
    );

  it('records what the extension saw as the agent observed', async () => {
    await expect(report('running')).resolves.toEqual({ matched: 1 });
    expect(sessions.findCloudByCloudIds).toHaveBeenCalledWith(SCOPE, [CLOUD_ID]);
    expect(sessions.appendEvents).toHaveBeenCalledWith(session, [
      expect.objectContaining({
        kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
        payload: { state: 'working', cloudState: 'running' },
      }),
    ]);
  });

  it('writes nothing for a repeat, but takes the second report of waiting on you', async () => {
    await report('running');
    await report('running');
    expect(sessions.appendEvents).toHaveBeenCalledTimes(1);

    await report('needs-input');
    await report('needs-input');
    await report('needs-input');
    // The change, then the confirmation that starts the clock; then nothing.
    expect(sessions.appendEvents).toHaveBeenCalledTimes(3);
    expect(session.lastObservedState).toBe('blocked');
    expect(session.observedSince).not.toBeNull();
  });

  it('reads a failed turn as waiting on you, and a finished one as done', async () => {
    await report('failed');
    expect(session.lastObservedState).toBe('blocked');
    await report('done');
    expect(session.lastObservedState).toBe('done');
  });

  it('touches nothing it was not asked about', async () => {
    sessions.findCloudByCloudIds.mockResolvedValue([]);
    await expect(report('running')).resolves.toEqual({ matched: 0 });
    expect(sessions.appendEvents).not.toHaveBeenCalled();
  });
});
