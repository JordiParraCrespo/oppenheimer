import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SessionLoaderResolver } from '../session-loader.resolver';

/**
 * Every person's command on an existing session loads it through here, so these
 * are the problem documents a missing or closed session answers with, byte for byte.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function session() {
  return WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
  });
}

function close(work: WorkSessionEntity) {
  work.recordEvent({
    seq: 1,
    kind: SESSION_EVENT_KINDS.CLOSED,
    payload: {},
    occurredAt: new Date(),
  });
}

describe('SessionLoaderResolver', () => {
  let sessions: { findOneById: ReturnType<typeof vi.fn> };
  let loader: SessionLoaderResolver;
  let work: WorkSessionEntity;

  beforeEach(() => {
    work = session();
    sessions = { findOneById: vi.fn().mockResolvedValue(Some(work)) };
    loader = new SessionLoaderResolver(sessions as unknown as WorkSessionRepositoryPort);
  });

  describe('find', () => {
    it('answers the session, looked up in the caller’s scope', async () => {
      await expect(loader.find(SCOPE, work.id)).resolves.toBe(work);
      expect(sessions.findOneById).toHaveBeenCalledWith(SCOPE, work.id);
    });

    it('answers a resolved session too', async () => {
      close(work);
      await expect(loader.find(SCOPE, work.id)).resolves.toBe(work);
    });

    it('is not found when the lookup finds nothing', async () => {
      sessions.findOneById.mockResolvedValue(None);
      await expect(loader.find(SCOPE, 'missing')).rejects.toMatchObject({
        code: 'SESSIONS_001',
        detail: 'No session with id missing',
      });
    });
  });

  describe('requireLive', () => {
    it('answers a live session', async () => {
      await expect(loader.requireLive(SCOPE, work.id)).resolves.toBe(work);
    });

    it('refuses a resolved session, by its slug', async () => {
      close(work);
      await expect(loader.requireLive(SCOPE, work.id)).rejects.toMatchObject({
        code: 'SESSIONS_005',
        detail: 'Session bold-otter-3f9a7k is closed',
      });
    });
  });
});
