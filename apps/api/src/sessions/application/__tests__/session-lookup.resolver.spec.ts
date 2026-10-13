import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { SessionShareRepositoryPort } from '../../database/session-share.repository.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SessionShareEntity } from '../../domain/session-share.entity';
import { SessionLookupResolver } from '../session-lookup.resolver';

/**
 * The relay's minute-by-minute question about a guest's open terminal: does
 * the share still open this session for them, with the access their ticket
 * was minted with? A wrong yes keeps a shell open after its owner took it back.
 */

const GUEST = { userId: 'u-guest', email: 'ada@example.com', emailVerified: true };

function writing() {
  return SessionShareEntity.share({
    organizationId: 'org-1',
    sessionId: 'session-1',
    sharedByUserId: 'u-owner',
    settings: { audience: 'people', access: 'write', people: [GUEST.email], lifetime: '1h' },
  });
}

function resolverOver(share: SessionShareEntity | null) {
  const shares = { findOneById: vi.fn().mockResolvedValue(share ? Some(share) : None) };
  return new SessionLookupResolver(
    {} as WorkSessionRepositoryPort,
    shares as unknown as SessionShareRepositoryPort,
  );
}

describe('SessionLookupResolver.shareAdmits', () => {
  it('admits a typing ticket while the share still lets its guest type', async () => {
    const share = writing();
    await expect(
      resolverOver(share).shareAdmits(share.id, 'session-1', GUEST, false),
    ).resolves.toBe(true);
  });

  it('ends a typing ticket once the share is narrowed to watching, and keeps a watching one', async () => {
    const share = writing();
    share.reshare('u-owner', {
      audience: 'people',
      access: 'read',
      people: [GUEST.email],
      lifetime: '24h',
    });
    const resolver = resolverOver(share);
    await expect(resolver.shareAdmits(share.id, 'session-1', GUEST, false)).resolves.toBe(false);
    await expect(resolver.shareAdmits(share.id, 'session-1', GUEST, true)).resolves.toBe(true);
  });

  it('ends it once the guest is taken off the list, or the share is stopped', async () => {
    const share = writing();
    share.setPeople(['someone@else.dev']);
    await expect(resolverOver(share).shareAdmits(share.id, 'session-1', GUEST, true)).resolves.toBe(
      false,
    );
    await expect(resolverOver(null).shareAdmits(share.id, 'session-1', GUEST, true)).resolves.toBe(
      false,
    );
  });

  it('never admits a share of another session', async () => {
    const share = writing();
    await expect(resolverOver(share).shareAdmits(share.id, 'session-2', GUEST, true)).resolves.toBe(
      false,
    );
  });
});
