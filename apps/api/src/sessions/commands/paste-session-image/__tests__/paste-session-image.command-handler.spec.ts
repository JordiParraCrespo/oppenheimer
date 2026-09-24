import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { SessionDispatchPort } from '../../../application/session-dispatch.port';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { PasteSessionImageCommand } from '../paste-session-image.command';
import { PasteSessionImageCommandHandler } from '../paste-session-image.command-handler';

/**
 * A pasted image reaches the host only when it is an image by its bytes and
 * the session has a pane to paste it into; everything else is refused before
 * a byte is sent.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

function openSession() {
  return WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'swift-wren-7gyezw',
    agent: 'claude-code',
  });
}

function harness(session: WorkSessionEntity | null) {
  const sessions = {
    findOneById: vi.fn().mockResolvedValue(session ? Some(session) : None),
  } as unknown as WorkSessionRepositoryPort;
  const dispatch = {
    pasteImage: vi.fn().mockResolvedValue({ delivered: true, hints: [] }),
  } as unknown as SessionDispatchPort;
  return { dispatch, handler: new PasteSessionImageCommandHandler(sessions, dispatch) };
}

const paste = (sessionId: string, data: Buffer, window = 0) =>
  new PasteSessionImageCommand({ scope: SCOPE, sessionId, window, data });

describe('PasteSessionImageCommandHandler', () => {
  it('sends the image with the type its bytes declare', async () => {
    const session = openSession();
    const { handler, dispatch } = harness(session);

    await expect(handler.execute(paste(session.id, PNG, 1))).resolves.toEqual({
      delivered: true,
      hints: [],
    });
    expect(dispatch.pasteImage).toHaveBeenCalledWith(session, {
      window: 1,
      mediaType: 'image/png',
      data: PNG,
    });
  });

  it('refuses bytes that are not an image with SESSIONS_012, whatever the browser called them', async () => {
    const session = openSession();
    const { handler, dispatch } = harness(session);

    await expect(
      handler.execute(paste(session.id, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))),
    ).rejects.toMatchObject({ code: 'SESSIONS_012' });
    expect(dispatch.pasteImage).not.toHaveBeenCalled();
  });

  it('answers SESSIONS_001 for a session the caller cannot see', async () => {
    const { handler, dispatch } = harness(null);

    await expect(
      handler.execute(paste('3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40', PNG)),
    ).rejects.toMatchObject({
      code: 'SESSIONS_001',
    });
    expect(dispatch.pasteImage).not.toHaveBeenCalled();
  });

  it('refuses a closed session with SESSIONS_005 and a stopped one with SESSIONS_013', async () => {
    const closed = { id: 'closed', slug: 'a', isResolved: true, stoppedAt: null };
    const stopped = { id: 'stopped', slug: 'b', isResolved: false, stoppedAt: new Date() };
    for (const [session, code] of [
      [closed, 'SESSIONS_005'],
      [stopped, 'SESSIONS_013'],
    ] as const) {
      const { handler, dispatch } = harness(session as unknown as WorkSessionEntity);
      await expect(handler.execute(paste(session.id, PNG))).rejects.toMatchObject({ code });
      expect(dispatch.pasteImage).not.toHaveBeenCalled();
    }
  });
});
