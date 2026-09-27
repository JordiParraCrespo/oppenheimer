import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostUsagePort } from '../../../application/host-usage.port';
import { HostUsageRegistry } from '../../../application/host-usage.registry';
import type { HostRepositoryPort } from '../../../database/host.repository.port';
import type { HostPairingTokenRepositoryPort } from '../../../database/host-pairing-token.repository.port';
import { HostEntity } from '../../../domain/host.entity';
import { HostPairingTokenEntity } from '../../../domain/host-pairing-token.entity';
import { FindPairingTokenQuery } from '../find-pairing-token.query';
import { FindPairingTokenQueryHandler } from '../find-pairing-token.query-handler';

const TOKEN_ID = '7b0a3f6c-7d1e-4c52-9a3b-5e2f1d0c9b8a';
const HOST_ID = 'c3e1a2b4-5d6f-4a7b-8c9d-0e1f2a3b4c5d';

function scope(): AccessScope {
  return { userId: 'jordi', organizationId: null, teamIds: [], grants: new Map(), bypass: false };
}

function token(redeemedHostId: string | null) {
  return HostPairingTokenEntity.create({
    id: TOKEN_ID,
    props: {
      ownerUserId: 'jordi',
      intendedName: 'build-02',
      prefix: 'opr_reg_a1b2c3',
      tokenHash: 'h'.repeat(64),
      createdFromIp: null,
      redeemedFromIp: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      redeemedAt: redeemedHostId ? new Date() : null,
      redeemedHostId,
    },
  });
}

function host() {
  return HostEntity.create({
    id: HOST_ID,
    props: {
      ownerUserId: 'jordi',
      name: 'build-02',
      hostname: 'build-02',
      os: 'ubuntu 24.04',
      arch: 'amd64',
      runnerVersion: '0.14.2',
      capabilities: null,
      publicKey: 'a'.repeat(44),
      publicKeyFingerprint: 'f'.repeat(64),
      lastSeenAt: new Date(),
      unpairedAt: null,
    },
  });
}

describe('FindPairingTokenQueryHandler', () => {
  let tokens: Pick<HostPairingTokenRepositoryPort, 'findOneById'>;
  let hosts: Pick<HostRepositoryPort, 'findOneByIdWithPresence'>;
  let usage: HostUsagePort;
  let handler: FindPairingTokenQueryHandler;

  beforeEach(() => {
    tokens = { findOneById: vi.fn().mockResolvedValue(Some(token(null))) };
    hosts = {
      findOneByIdWithPresence: vi.fn().mockResolvedValue(Some({ host: host(), online: true })),
    };
    usage = { countRunningSessions: vi.fn(async () => new Map([[HOST_ID, 1]])) };
    const registry = new HostUsageRegistry();
    registry.register(usage);
    handler = new FindPairingTokenQueryHandler(
      tokens as HostPairingTokenRepositoryPort,
      hosts as HostRepositoryPort,
      registry,
    );
  });

  const query = () => new FindPairingTokenQuery({ scope: scope(), tokenId: TOKEN_ID });

  it('answers with no host while the token is still waiting for a machine', async () => {
    const status = await handler.execute(query());

    expect(status.token.id).toBe(TOKEN_ID);
    expect(status.host).toBeNull();
    expect(hosts.findOneByIdWithPresence).not.toHaveBeenCalled();
  });

  it('carries the host the token paired, as the list would show it', async () => {
    vi.mocked(tokens.findOneById).mockResolvedValue(Some(token(HOST_ID)));

    const status = await handler.execute(query());

    expect(hosts.findOneByIdWithPresence).toHaveBeenCalledWith(expect.anything(), HOST_ID);
    expect(status.host).toMatchObject({ online: true, runningSessions: 1 });
    expect(status.host?.host.name).toBe('build-02');
  });

  it('reads a paired host outside the caller’s scope as no host, not as an error', async () => {
    vi.mocked(tokens.findOneById).mockResolvedValue(Some(token(HOST_ID)));
    vi.mocked(hosts.findOneByIdWithPresence).mockResolvedValue(None);

    expect((await handler.execute(query())).host).toBeNull();
  });

  it('reports a token outside the caller’s scope as missing', async () => {
    vi.mocked(tokens.findOneById).mockResolvedValue(None);

    await expect(handler.execute(query())).rejects.toMatchObject({ code: 'HOSTS_002' });
  });
});
