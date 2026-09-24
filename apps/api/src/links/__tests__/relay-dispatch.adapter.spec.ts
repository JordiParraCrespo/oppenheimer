import 'reflect-metadata';
import { sessionCreateSchema, sessionImageSchema } from '@oppenheimer/shared/protocol';
import { describe, expect, it, vi } from 'vitest';
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
  return { link, adapter: new RelayDispatchAdapter(links) };
}

describe('RelayDispatchAdapter', () => {
  it('answers host_offline, and sends nothing, when the host holds no link', async () => {
    const { adapter, link } = harness(false);
    const outcome = await adapter.create(session(), {
      organizationSlug: 'jordi',
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
      organizationSlug: 'jordi',
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

  it('names an operation the wire has no frame for, rather than a delivery that did not happen', async () => {
    const { adapter, link } = harness(true);
    const entity = session();
    const outcome = await adapter.addCheckout(entity, entity.checkouts[0], {
      organizationSlug: 'jordi',
      projectSlug: 'xrp-mobile',
      branch: 'x',
    });
    expect(outcome).toEqual({ delivered: false, hints: ['not_supported'] });
    expect(link.send).not.toHaveBeenCalled();
  });

  it('sends a session.image the protocol accepts, the bytes as base64', async () => {
    const { adapter, link } = harness(true);
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const work = session();

    const outcome = await adapter.pasteImage(work, { window: 0, mediaType: 'image/png', data });

    expect(outcome).toEqual({ delivered: true, hints: [] });
    const sent = sessionImageSchema.parse(vi.mocked(link.send).mock.calls[0]?.[0]);
    expect(sent).toMatchObject({ sessionId: work.id, window: 0, mediaType: 'image/png' });
    expect(Buffer.from(sent.data, 'base64')).toEqual(data);
  });

  it('holds no image for a host that is offline', async () => {
    const { adapter, link } = harness(false);
    const outcome = await adapter.pasteImage(session(), {
      window: 0,
      mediaType: 'image/png',
      data: Buffer.from([0x89]),
    });
    expect(outcome).toEqual({ delivered: false, hints: ['host_offline'] });
    expect(link.send).not.toHaveBeenCalled();
  });
});
