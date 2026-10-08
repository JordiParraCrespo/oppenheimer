import type { CacheService } from '@oppenheimer/backend-cache';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttachTicketFactory } from '../../../application/attach-ticket.factory';
import { ShareLinkAccessResolver } from '../../../application/share-link-access.resolver';
import type { SessionShareLinkRepositoryPort } from '../../../database/session-share-link.repository.port';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SessionShareLinkEntity } from '../../../domain/session-share-link.entity';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { IssueSharedAttachTicketCommand } from '../issue-shared-attach-ticket.command';
import { IssueSharedAttachTicketCommandHandler } from '../issue-shared-attach-ticket.command-handler';

/**
 * A holder's ticket is judged as the person who shared the link, and carries
 * the link, so the relay can re-check it and keep a `read` link from typing.
 * A link that opens nothing mints nothing.
 */

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
  let link: SessionShareLinkEntity;
  let token: string;
  let links: { findOneByTokenHash: ReturnType<typeof vi.fn> };
  let sessions: { findOneByIdForMachine: ReturnType<typeof vi.fn> };
  let cache: { setIfAbsent: ReturnType<typeof vi.fn> };
  let handler: IssueSharedAttachTicketCommandHandler;

  beforeEach(() => {
    work = session();
    ({ link, token } = SessionShareLinkEntity.issue({
      organizationId: 'org-1',
      sessionId: work.id,
      createdByUserId: 'u-owner',
      access: 'read',
      audience: 'anyone',
    }));
    links = { findOneByTokenHash: vi.fn().mockResolvedValue(Some(link)) };
    sessions = { findOneByIdForMachine: vi.fn().mockResolvedValue(Some(work)) };
    cache = { setIfAbsent: vi.fn().mockResolvedValue(true) };
    handler = new IssueSharedAttachTicketCommandHandler(
      new ShareLinkAccessResolver(
        links as unknown as SessionShareLinkRepositoryPort,
        sessions as unknown as WorkSessionRepositoryPort,
      ),
      new AttachTicketFactory(cache as unknown as CacheService),
    );
  });

  const command = (viewer: IssueSharedAttachTicketCommand['viewer'] = null) =>
    new IssueSharedAttachTicketCommand({ token, viewer, window: 0 });

  it('mints a ticket judged as the creator, naming the link and its access', async () => {
    await handler.execute(command());

    expect(cache.setIfAbsent).toHaveBeenCalledWith(
      expect.stringMatching(/^attach:/),
      {
        sessionId: work.id,
        organizationId: 'org-1',
        window: 0,
        userId: 'u-owner',
        share: { linkId: link.id, readOnly: true, viewerUserId: null },
      },
      60,
    );
  });

  it('mints nothing for an unknown secret', async () => {
    links.findOneByTokenHash.mockResolvedValue(None);
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'SESSIONS_021' });
    expect(cache.setIfAbsent).not.toHaveBeenCalled();
  });

  it('mints nothing for a revoked link', async () => {
    link.revoke();
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'SESSIONS_021' });
    expect(cache.setIfAbsent).not.toHaveBeenCalled();
  });

  it('mints nothing once the session is closed', async () => {
    vi.spyOn(work, 'isResolved', 'get').mockReturnValue(true);
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'SESSIONS_021' });
  });

  it('mints nothing for a link whose row names another workspace’s session', async () => {
    sessions.findOneByIdForMachine.mockResolvedValue(Some(session('org-2')));
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'SESSIONS_021' });
  });
});
