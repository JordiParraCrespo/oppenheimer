import { generateKeyPairSync, randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { hostUpdateSchema } from '@oppenheimer/shared/protocol';
import { None, Some } from 'oxide.ts';
import type {
  LinkRegistryPort,
  RunnerLink,
} from '../../../../links/application/link-registry.port';
import type { HostRepositoryPort } from '../../../database/host.repository.port';
import { HostEntity } from '../../../domain/host.entity';
import { keyFingerprint } from '../../../infrastructure/host-assertion.util';
import type { RunnerReleaseConfig } from '../../../infrastructure/runner-release.config';
import { UpdateHostRunnerCommand } from '../update-host-runner.command';
import { UpdateHostRunnerCommandHandler } from '../update-host-runner.command-handler';

/**
 * Update runner: one `host.update` down the host's link, with no `version` — a
 * version would pin the host to it, and the console asks for the newest — and
 * `HOSTS_008` whenever there is no link to carry it. A host the caller cannot
 * reach, or one already unpaired, is `HOSTS_001` and nothing is sent.
 */
const userId = randomUUID();
const scope: AccessScope = {
  userId,
  organizationId: randomUUID(),
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function host(unpairedAt: Date | null = null) {
  const { publicKey } = generateKeyPairSync('ed25519');
  const base64 = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64');
  return HostEntity.create({
    id: randomUUID(),
    props: {
      ownerUserId: userId,
      name: 'mini-pc-500',
      hostname: 'mini-pc-500',
      os: 'linux',
      arch: 'amd64',
      runnerVersion: '0.1.0',
      capabilities: null,
      publicKey: base64,
      publicKeyFingerprint: keyFingerprint(base64) as string,
      lastSeenAt: null,
      unpairedAt,
    },
  });
}

function setup(found: HostEntity | null, link: { writable: boolean } | null) {
  const send = vi.fn<RunnerLink['send']>(() => link?.writable ?? false);
  const hosts: Pick<HostRepositoryPort, 'findOneById'> = {
    findOneById: vi.fn(async () => (found ? Some(found) : None)),
  };
  const links: Pick<LinkRegistryPort, 'find'> = {
    find: vi.fn(() => (link ? ({ send } as unknown as RunnerLink) : undefined)),
  };
  const release = { channel: 'beta' } as RunnerReleaseConfig;
  const handler = new UpdateHostRunnerCommandHandler(
    hosts as HostRepositoryPort,
    links as LinkRegistryPort,
    release,
  );
  const run = (hostId: string) => handler.execute(new UpdateHostRunnerCommand({ scope, hostId }));
  return { send, run };
}

describe('UpdateHostRunnerCommandHandler', () => {
  it('sends an unpinned host.update on the deployment channel', async () => {
    const target = host();
    const { send, run } = setup(target, { writable: true });

    await run(target.id);

    const sent = hostUpdateSchema.strict().parse(send.mock.calls[0]?.[0]);
    expect(sent.channel).toBe('beta');
    expect(sent).not.toHaveProperty('version');
  });

  it('refuses with HOSTS_008 when the host has no link', async () => {
    const target = host();
    const { run } = setup(target, null);
    await expect(run(target.id)).rejects.toMatchObject({ code: 'HOSTS_008' });
  });

  it('refuses with HOSTS_008 when the link can no longer be written', async () => {
    const target = host();
    const { run } = setup(target, { writable: false });
    await expect(run(target.id)).rejects.toMatchObject({ code: 'HOSTS_008' });
  });

  it('answers HOSTS_001 for an unpaired host and sends nothing', async () => {
    const target = host(new Date());
    const { send, run } = setup(target, { writable: true });
    await expect(run(target.id)).rejects.toMatchObject({ code: 'HOSTS_001' });
    expect(send).not.toHaveBeenCalled();
  });

  it('answers HOSTS_001 for a host the caller cannot reach', async () => {
    const { send, run } = setup(null, { writable: true });
    await expect(run(randomUUID())).rejects.toMatchObject({ code: 'HOSTS_001' });
    expect(send).not.toHaveBeenCalled();
  });
});
