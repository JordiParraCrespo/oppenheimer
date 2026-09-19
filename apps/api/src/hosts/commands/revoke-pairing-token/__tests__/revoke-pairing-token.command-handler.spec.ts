import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostPairingTokenRepositoryPort } from '../../../database/host-pairing-token.repository.port';
import { HostPairingTokenEntity } from '../../../domain/host-pairing-token.entity';
import { RevokePairingTokenCommand } from '../revoke-pairing-token.command';
import { RevokePairingTokenCommandHandler } from '../revoke-pairing-token.command-handler';

function scope(): AccessScope {
  return {
    userId: 'jordi',
    organizationId: null,
    teamIds: [],
    grants: new Map(),
    bypass: false,
  };
}

function token(revokedAt: Date | null = null) {
  return HostPairingTokenEntity.create({
    id: 'token-1',
    props: {
      createdByUserId: 'jordi',
      intendedName: 'Dev box',
      prefix: 'opr_reg_abcdef',
      tokenHash: 'h'.repeat(64),
      createdFromIp: null,
      redeemedFromIp: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt,
      redeemedAt: null,
      redeemedHostId: null,
    },
  });
}

describe('RevokePairingTokenCommandHandler', () => {
  let tokens: Pick<HostPairingTokenRepositoryPort, 'findOneById' | 'save'>;
  let handler: RevokePairingTokenCommandHandler;

  beforeEach(() => {
    tokens = {
      findOneById: vi.fn().mockResolvedValue(Some(token())),
      save: vi.fn(async (entity) => entity),
    };
    handler = new RevokePairingTokenCommandHandler(tokens as HostPairingTokenRepositoryPort);
  });

  const command = () => new RevokePairingTokenCommand({ scope: scope(), tokenId: 'token-1' });

  it('writes the column the redemption statement reads', async () => {
    await handler.execute(command());

    const [saved] = vi.mocked(tokens.save).mock.calls[0];
    // `revokedAt IS NULL` is a term of the burn, so this one column is the whole
    // of revocation — without it a revoked token would still pair a machine.
    expect(saved.revokedAt).toBeInstanceOf(Date);
  });

  it('reads through the caller’s own scope', async () => {
    await handler.execute(command());

    expect(tokens.findOneById).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'jordi' }),
      'token-1',
    );
  });

  it('keeps the first revocation when asked twice', async () => {
    const already = new Date('2026-09-01T00:00:00Z');
    vi.mocked(tokens.findOneById).mockResolvedValue(Some(token(already)));

    await handler.execute(command());

    const [saved] = vi.mocked(tokens.save).mock.calls[0];
    expect(saved.revokedAt).toEqual(already);
  });

  it('reports somebody else’s token as missing', async () => {
    // The scoped read cannot see it, and saying more would confirm the id.
    vi.mocked(tokens.findOneById).mockResolvedValue(None);

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_002' });
  });
});
