import 'reflect-metadata';
import { sessionCreateSchema } from '@oppenheimer/shared/protocol';
import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { OrganizationOrmEntity } from '../../organizations/database/organization.orm-entity';
import { SessionCheckoutEntity } from '../../sessions/domain/session-checkout.entity';
import { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { RelayDispatchAdapter } from '../infrastructure/relay-dispatch.adapter';

/**
 * The dispatcher's whole contract: an honest `delivered`, a `session.create`
 * the runner's schema accepts, and never a write.
 */

const ORG = 'b8a4c2d0-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const PROJECT = 'c9b5d3e1-2f30-4b4c-9d5e-6f708192a3b4';
const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';

function session(): WorkSessionEntity {
  const entity = WorkSessionEntity.request({
    organizationId: ORG,
    projectId: PROJECT,
    createdByUserId: 'user-1',
    hostId: HOST,
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
  });
  (entity.checkouts as SessionCheckoutEntity[]).push(
    SessionCheckoutEntity.createNew({
      organizationId: ORG,
      sessionId: entity.id,
      installationId: 'inst-1',
      githubRepoId: '42',
      repositoryFullName: 'acme/xrp-mobile',
      directoryName: 'xrp-mobile',
      baseBranch: 'main',
      branch: 'oppenheimer/xrp-mobile/bold-otter-3f9a7k',
    }),
  );
  return entity;
}

function harness(withLink: boolean) {
  const link = {
    hostId: HOST,
    runId: 'run-1',
    epoch: 1,
    send: vi.fn().mockReturnValue(true),
  } as unknown as RunnerLink;
  const links: LinkRegistryPort = {
    register: vi.fn(),
    unregister: vi.fn(),
    nextEpoch: vi.fn(),
    find: vi.fn().mockReturnValue(withLink ? link : undefined),
  };
  const organizations = {
    findOne: vi.fn().mockResolvedValue({ id: ORG, slug: 'jordi' }),
  } as unknown as Repository<OrganizationOrmEntity>;
  return { link, adapter: new RelayDispatchAdapter(links, organizations) };
}

describe('RelayDispatchAdapter', () => {
  it('answers host_offline, and sends nothing, when the host holds no link', async () => {
    const { adapter, link } = harness(false);
    const outcome = await adapter.create(session(), {
      projectSlug: 'xrp-mobile',
      branch: 'oppenheimer/xrp-mobile/bold-otter-3f9a7k',
    });
    expect(outcome).toEqual({ delivered: false, hints: ['host_offline'] });
    expect(link.send).not.toHaveBeenCalled();
  });

  it('sends a session.create the protocol accepts, with the launch as fields', async () => {
    const { adapter, link } = harness(true);
    const entity = session();
    const outcome = await adapter.create(entity, {
      projectSlug: 'xrp-mobile',
      branch: 'oppenheimer/xrp-mobile/bold-otter-3f9a7k',
      prompt: 'Fix the wallet list empty state',
    });
    expect(outcome).toEqual({ delivered: true, hints: [] });
    const [message] = vi.mocked(link.send).mock.calls[0];
    const parsed = sessionCreateSchema.parse(message);
    expect(parsed.sessionId).toBe(entity.id);
    expect(parsed.organizationSlug).toBe('jordi');
    expect(parsed.sessionSlug).toBe('bold-otter-3f9a7k');
    expect(parsed.launch).toEqual({ permission: 'ask' });
    expect(parsed.prompt).toBe('Fix the wallet list empty state');
    expect(parsed.checkouts).toEqual([
      expect.objectContaining({ githubRepoId: 42, repositoryFullName: 'acme/xrp-mobile' }),
    ]);
  });

  it('reports a link that could not queue the frame as offline', async () => {
    const { adapter, link } = harness(true);
    vi.mocked(link.send).mockReturnValue(false);
    const outcome = await adapter.stop(session());
    expect(outcome).toEqual({ delivered: false, hints: ['host_offline'] });
  });

  it('carries the close decision through', async () => {
    const { adapter, link } = harness(true);
    await adapter.close(session(), { acceptUnpushedWork: true });
    expect(link.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session.close', acceptUnpushedWork: true }),
    );
  });
});
