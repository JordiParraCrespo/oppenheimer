import { Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionLoaderResolver } from '../../../application/session-loader.resolver';
import type {
  SessionSharedFilesPort,
  SessionSharedPreviewOutcome,
} from '../../../application/session-shared-files.port';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { FindSessionSharedPreviewQuery } from '../find-session-shared-preview.query';
import { FindSessionSharedPreviewQueryHandler } from '../find-session-shared-preview.query-handler';

/**
 * A bot's read of a shared file's preview: only a file the session lists, and
 * one the runner kept a preview of, is asked of the host, and of the
 * session's own host about this session; a runner's refusal is `gone` with
 * its code, never a thrown turn. The wire is the relay adapter's spec.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

describe('FindSessionSharedPreviewQueryHandler', () => {
  let outcome: SessionSharedPreviewOutcome;
  let shared: { preview: ReturnType<typeof vi.fn> };
  let handler: FindSessionSharedPreviewQueryHandler;
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
    const at = new Date('2026-11-03T10:00:00.000Z');
    work.recordEvents([
      { seq: 1, kind: SESSION_EVENT_KINDS.STARTED, payload: {}, occurredAt: at },
      {
        seq: 2,
        kind: SESSION_EVENT_KINDS.FILE_SHARED,
        payload: {
          id: 'img1',
          name: 'home.png',
          mediaType: 'image/png',
          size: 9,
          hasPreview: true,
        },
        occurredAt: at,
      },
      {
        seq: 3,
        kind: SESSION_EVENT_KINDS.FILE_SHARED,
        payload: {
          id: 'txt1',
          name: 'notes.md',
          mediaType: 'text/markdown',
          size: 9,
          hasPreview: false,
        },
        occurredAt: at,
      },
    ]);
    const sessions = {
      findOneById: vi.fn().mockResolvedValue(Some(work)),
    } as unknown as WorkSessionRepositoryPort;
    shared = { preview: vi.fn(async () => outcome) };
    handler = new FindSessionSharedPreviewQueryHandler(
      new SessionLoaderResolver(sessions),
      shared as unknown as SessionSharedFilesPort,
    );
  });

  const read = (fileId: string) =>
    handler.execute(
      new FindSessionSharedPreviewQuery({ scope: SCOPE, sessionId: work.id, fileId }),
    );

  it("answers the preview, asking the session's own host about this session", async () => {
    outcome = { kind: 'preview', mediaType: 'image/jpeg', data: '/9j/' };
    await expect(read('img1')).resolves.toMatchObject({
      kind: 'preview',
      file: { id: 'img1', name: 'home.png' },
      data: '/9j/',
    });
    expect(shared.preview).toHaveBeenCalledWith('host-1', work.id, 'img1');
  });

  // The regression: any id a bot makes up, or a text file, sent to the host,
  // which would answer it only with a refusal after a round trip.
  it('never asks the host about a file the session does not list, or one with no preview', async () => {
    await expect(read('made-up')).resolves.toEqual({ kind: 'unknown_file' });
    await expect(read('txt1')).resolves.toMatchObject({ kind: 'no_preview', file: { id: 'txt1' } });
    expect(shared.preview).not.toHaveBeenCalled();
  });

  it('answers a refusal from the host as gone, with its code', async () => {
    outcome = { kind: 'failed', code: 'SESS_016', detail: 'cleaned up' };
    await expect(read('img1')).resolves.toMatchObject({ kind: 'gone', code: 'SESS_016' });
    outcome = { kind: 'timed_out' };
    await expect(read('img1')).resolves.toMatchObject({ kind: 'timed_out' });
  });
});
