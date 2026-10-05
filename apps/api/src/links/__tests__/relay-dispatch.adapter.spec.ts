import 'reflect-metadata';
import {
  type RunnerCapability,
  sessionCreateSchema,
  sessionImageSchema,
} from '@oppenheimer/shared/protocol';
import { describe, expect, it, vi } from 'vitest';
import { SessionCheckoutEntity } from '../../sessions/domain/session-checkout.entity';
import { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import type { ParkedFilePort } from '../application/parked-file.port';
import { RelayDispatchAdapter } from '../infrastructure/relay-dispatch.adapter';

/**
 * The dispatcher's whole contract: an honest `delivered`, a `session.create`
 * the runner's schema accepts, and never a write.
 */

const ORG = 'b8a4c2d0-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const PROJECT = 'c9b5d3e1-2f30-4b4c-9d5e-6f708192a3b4';
const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';

function session(agent: 'claude-code' | 'shell' = 'claude-code'): WorkSessionEntity {
  const entity = WorkSessionEntity.request({
    organizationId: ORG,
    projectId: PROJECT,
    createdByUserId: 'user-1',
    hostId: HOST,
    slug: 'bold-otter-3f9a7k',
    agent,
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

function harness(withLink: boolean, capabilities: RunnerCapability[] = ['session.image']) {
  const link = {
    hostId: HOST,
    runId: 'run-1',
    epoch: 1,
    capabilities,
    send: vi.fn().mockReturnValue(true),
  } as unknown as RunnerLink;
  const images = {
    park: vi.fn(),
    stage: vi.fn(),
    claim: vi.fn(),
    collect: vi.fn(),
  } satisfies ParkedFilePort;
  const links: LinkRegistryPort = {
    register: vi.fn(),
    unregister: vi.fn(),
    nextEpoch: vi.fn(),
    find: vi.fn().mockReturnValue(withLink ? link : undefined),
  };
  return { link, images, adapter: new RelayDispatchAdapter(links, images) };
}

describe('RelayDispatchAdapter', () => {
  it('answers host_offline, and sends nothing, when the host holds no link', async () => {
    const { adapter, link } = harness(false);
    const outcome = await adapter.create(session(), {
      organizationSlug: 'jordi',
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
      branch: 'oppenheimer/xrp-mobile/bold-otter-3f9a7k',
      prompt: 'Fix the wallet list empty state',
    });
    expect(outcome).toEqual({ delivered: true, hints: [] });
    const [message] = vi.mocked(link.send).mock.calls[0];
    const parsed = sessionCreateSchema.parse(message);
    expect(parsed.sessionId).toBe(entity.id);
    expect(parsed.organizationSlug).toBe('jordi');
    expect(parsed.sessionSlug).toBe('bold-otter-3f9a7k');
    // The conversation is the session's own id: it is what lets the agent's
    // transcript be reopened once the pane is gone.
    expect(parsed.launch).toEqual({ permission: 'ask', conversation: entity.id });
    expect(parsed.prompt).toBe('Fix the wallet list empty state');
    expect(parsed.checkouts).toEqual([
      expect.objectContaining({ githubRepoId: 42, repositoryFullName: 'acme/xrp-mobile' }),
    ]);
  });

  it('sends a blank terminal with no permission level', async () => {
    const { adapter, link } = harness(true);
    await adapter.create(session('shell'), {
      organizationSlug: 'jordi',
      branch: 'oppenheimer/xrp-mobile/bold-otter-3f9a7k',
    });
    const [message] = vi.mocked(link.send).mock.calls[0];
    const parsed = sessionCreateSchema.parse(message);
    expect(parsed.agent).toBe('shell');
    expect(parsed.launch).toEqual({});
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
      branch: 'x',
    });
    expect(outcome).toEqual({ delivered: false, hints: ['not_supported'] });
    expect(link.send).not.toHaveBeenCalled();
  });

  it('parks the bytes and sends only the command, which the protocol accepts', async () => {
    const { adapter, link, images } = harness(true);
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const work = session();

    const outcome = await adapter.pasteFile(work, { window: 0, mediaType: 'image/png', data });

    expect(outcome).toEqual({ delivered: true, hints: [] });
    const sent = sessionImageSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]);
    expect(sent).toMatchObject({ sessionId: work.id, window: 0, mediaType: 'image/png' });
    expect(images.park).toHaveBeenCalledWith(sent.commandId, {
      hostId: HOST,
      sessionId: work.id,
      mediaType: 'image/png',
      data,
    });
  });

  it('parks nothing for a host that is offline', async () => {
    const { adapter, link, images } = harness(false);
    const outcome = await adapter.pasteFile(session(), {
      window: 0,
      mediaType: 'image/png',
      data: Buffer.from([0x89]),
    });
    expect(outcome).toEqual({ delivered: false, hints: ['host_offline'] });
    expect(link.send).not.toHaveBeenCalled();
    expect(images.park).not.toHaveBeenCalled();
  });

  it('sends nothing to a runner that did not say it takes images', async () => {
    const { adapter, link, images } = harness(true, []);
    const outcome = await adapter.pasteFile(session(), {
      window: 0,
      mediaType: 'image/png',
      data: Buffer.from([0x89]),
    });
    expect(outcome).toEqual({ delivered: false, hints: ['not_supported'] });
    expect(link.send).not.toHaveBeenCalled();
    expect(images.park).not.toHaveBeenCalled();
  });

  it('sends a PDF only to a runner that said it takes files beyond images', async () => {
    const pdf = { window: 0, mediaType: 'application/pdf' as const, data: Buffer.from('%PDF-1.7') };

    const older = harness(true, ['session.image']);
    expect(await older.adapter.pasteFile(session(), pdf)).toEqual({
      delivered: false,
      hints: ['not_supported'],
    });
    // Parked bytes would wait for a pull that is refused on arrival.
    expect(older.images.park).not.toHaveBeenCalled();

    const current = harness(true, ['session.image', 'session.files']);
    expect(await current.adapter.pasteFile(session(), pdf)).toEqual({
      delivered: true,
      hints: [],
    });
    const sent = sessionImageSchema.strict().parse(vi.mocked(current.link.send).mock.calls[0]?.[0]);
    expect(sent.mediaType).toBe('application/pdf');
  });

  describe('a first task with images', () => {
    const imageId = '5b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';
    const spec = {
      organizationSlug: 'jordi',
      branch: 'oppenheimer/xrp-mobile/bold-otter-3f9a7k',
      prompt: 'Match this screenshot',
      images: [{ imageId, mediaType: 'image/png' as const }],
    };

    it('names the parked images on the create, and parks nothing itself', async () => {
      const { adapter, link, images } = harness(true, ['session.create.images']);

      const outcome = await adapter.create(session(), spec);

      expect(outcome).toEqual({ delivered: true, hints: [] });
      const sent = sessionCreateSchema.parse(vi.mocked(link.send).mock.calls[0]?.[0]);
      expect(sent.images).toEqual([{ imageId, mediaType: 'image/png' }]);
      // The images were parked when the create claimed them, before the row.
      expect(images.park).not.toHaveBeenCalled();
    });

    it('sends text to a runner at launch only when it takes files beyond images', async () => {
      const withText = {
        ...spec,
        images: [
          ...spec.images,
          { imageId: '6c2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d5e', mediaType: 'text/markdown' as const },
        ],
      };

      const older = harness(true, ['session.create.images']);
      expect(await older.adapter.create(session(), withText)).toEqual({
        delivered: false,
        hints: ['not_supported'],
      });
      expect(older.link.send).not.toHaveBeenCalled();

      const current = harness(true, ['session.create.images', 'session.files']);
      expect(await current.adapter.create(session(), withText)).toEqual({
        delivered: true,
        hints: [],
      });
    });

    it('sends nothing to a runner that cannot take them at launch', async () => {
      const { adapter, link } = harness(true, ['session.image']);

      const outcome = await adapter.create(session(), spec);

      expect(outcome).toEqual({ delivered: false, hints: ['not_supported'] });
      expect(link.send).not.toHaveBeenCalled();
    });
  });
});
