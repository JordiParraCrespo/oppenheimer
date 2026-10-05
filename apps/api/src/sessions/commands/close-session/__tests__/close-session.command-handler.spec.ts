import { Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDispatchPort } from '../../../application/session-dispatch.port';
import { SessionLoaderResolver } from '../../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { CloseSessionCommand } from '../close-session.command';
import { CloseSessionCommandHandler } from '../close-session.command-handler';

/**
 * Closing is idempotent: a session that is already resolved answers as if the
 * close had just gone through, and nothing is appended or sent.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

describe('CloseSessionCommandHandler', () => {
  let sessions: { findOneById: ReturnType<typeof vi.fn>; appendEvents: ReturnType<typeof vi.fn> };
  let dispatch: { close: ReturnType<typeof vi.fn> };
  let handler: CloseSessionCommandHandler;
  let work: WorkSessionEntity;

  beforeEach(() => {
    work = WorkSessionEntity.request({
      organizationId: 'org-acme',
      projectId: 'project-1',
      createdByUserId: 'user-1',
      hostId: 'host-1',
      slug: 'bold-otter-3f9a7k',
      agent: 'claude-code',
    });
    sessions = {
      findOneById: vi.fn().mockResolvedValue(Some(work)),
      appendEvents: vi.fn().mockResolvedValue(undefined),
    };
    dispatch = { close: vi.fn().mockResolvedValue({ delivered: true, hints: [] }) };
    const repository = sessions as unknown as WorkSessionRepositoryPort;
    handler = new CloseSessionCommandHandler(
      new SessionLoaderResolver(repository),
      repository,
      dispatch as unknown as SessionDispatchPort,
    );
  });

  const command = () =>
    new CloseSessionCommand({ scope: SCOPE, sessionId: work.id, acceptUnpushedWork: true });

  it('records a request, not an outcome, and tells the host what the caller accepted', async () => {
    await expect(handler.execute(command())).resolves.toEqual({ sessionId: work.id, hints: [] });
    // Only the host can say the close happened.
    expect(sessions.appendEvents).toHaveBeenCalledWith(work, [
      expect.objectContaining({
        kind: SESSION_EVENT_KINDS.CLOSE_REQUESTED,
        payload: { acceptUnpushedWork: true },
      }),
    ]);
    expect(dispatch.close).toHaveBeenCalledWith(work, { acceptUnpushedWork: true });
    expect(work.isResolved).toBe(false);
  });

  it('is a no-op on a session that is already closed', async () => {
    work.recordEvent({
      seq: 1,
      kind: SESSION_EVENT_KINDS.CLOSED,
      payload: {},
      occurredAt: new Date(),
    });

    await expect(handler.execute(command())).resolves.toEqual({ sessionId: work.id, hints: [] });
    expect(sessions.appendEvents).not.toHaveBeenCalled();
    expect(dispatch.close).not.toHaveBeenCalled();
  });
});
