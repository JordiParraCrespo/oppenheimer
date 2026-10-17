import type { CacheService } from '@oppenheimer/backend-cache';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttachTicketFactory } from '../../../application/attach-ticket.factory';
import { SessionShareAccessResolver } from '../../../application/session-share-access.resolver';
import type { SessionShareRepositoryPort } from '../../../database/session-share.repository.port';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SessionShareEntity } from '../../../domain/session-share.entity';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { IssueSharedAttachTicketCommand } from '../issue-shared-attach-ticket.command';
import { IssueSharedAttachTicketCommandHandler } from '../issue-shared-attach-ticket.command-handler';

/**
 * A guest's ticket is judged as the person who shared the session, and
 * carries the share and the guest, so the relay can re-check both and keep a
 * `read` share from typing. A share that opens nothing mints nothing.
 */

const GUEST = { userId: 'u-guest', email: 'guest@example.com', emailVerified: true };

function session(organizationId = 'org-1') {
  return WorkSessionEntity.request({
    organizationId,
    projectId: 'project-1',
    createdByUserId: 'u-owner',
    hostId: 'host-1',
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
  });
}

describe('IssueSharedAttachTicketCommandHandler', () => {
  let work: WorkSessionEntity;
  let share: SessionShareEntity;
  let shares: { findOneBySlug: ReturnType<typeof vi.fn> };
  let sessions: { findOneByIdForMachine: ReturnType<typeof vi.fn> };
  let cache: { setIfAbsent: ReturnType<typeof vi.fn> };
  let handler: IssueSharedAttachTicketCommandHandler;

  beforeEach(() => {
    work = session();
    share = SessionShareEntity.share({
      organizationId: 'org-1',
      sessionId: work.id,
      sharedByUserId: 'u-owner',
      settings: { audience: 'link', access: 'read', lifetime: '24h' },
    });
    shares = { findOneBySlug: vi.fn().mockResolvedValue(Some(share)) };
    sessions = { findOneByIdForMachine: vi.fn().mockResolvedValue(Some(work)) };
    cache = { setIfAbsent: vi.fn().mockResolvedValue(true) };
    handler = new IssueSharedAttachTicketCommandHandler(
      new SessionShareAccessResolver(
        shares as unknown as SessionShareRepositoryPort,
        sessions as unknown as WorkSessionRepositoryPort,
      ),
      new AttachTicketFactory(cache as unknown as CacheService),
    );
  });

  const command = (viewer: IssueSharedAttachTicketCommand['viewer'] = GUEST) =>
    new IssueSharedAttachTicketCommand({ slug: share.slug, viewer });

  it('mints a ticket judged as the sharer, naming the share, its access and the guest', async () => {
    await handler.execute(command());

    expect(cache.setIfAbsent).toHaveBeenCalledWith(
      expect.stringMatching(/^attach:/),
      {
        sessionId: work.id,
        organizationId: 'org-1',
        window: 0,
        userId: 'u-owner',
        share: { shareId: share.id, readOnly: true, viewerUserId: 'u-guest' },
      },
      60,
    );
  });

  it('asks a signed-out caller to sign in before reading the share', async () => {
    await expect(handler.execute(command(null))).rejects.toMatchObject({ code: 'SESSIONS_022' });
    expect(shares.findOneBySlug).not.toHaveBeenCalled();
    expect(cache.setIfAbsent).not.toHaveBeenCalled();
  });

  it('mints nothing for an address that is not shared', async () => {
    shares.findOneBySlug.mockResolvedValue(None);
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'SESSIONS_021' });
    expect(cache.setIfAbsent).not.toHaveBeenCalled();
  });

  it('mints nothing for someone a people share does not name', async () => {
    share.reshare('u-owner', {
      audience: 'people',
      access: 'write',
      people: ['ada@example.com'],
      lifetime: '1h',
    });
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'SESSIONS_023' });
    expect(cache.setIfAbsent).not.toHaveBeenCalled();
  });

  it('mints nothing once the session is closed', async () => {
    vi.spyOn(work, 'isResolved', 'get').mockReturnValue(true);
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'SESSIONS_021' });
  });

  it('mints nothing for a share whose row names another workspace’s session', async () => {
    sessions.findOneByIdForMachine.mockResolvedValue(Some(session('org-2')));
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'SESSIONS_021' });
  });
});
