import 'reflect-metadata';
import {
  type RunnerCapability,
  repositoryPrepareSchema,
  sessionCreateSchema,
  sessionImageSchema,
  sessionInputSchema,
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
/** What the launch factory reads off the workspace. */
const NAMES = { organizationSlug: 'jordi', workspaceId: ORG };

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
      ...NAMES,
      branch: 'oppenheimer/xrp-mobile/bold-otter-3f9a7k',
    });
    expect(outcome).toEqual({ delivered: false, hints: ['host_offline'] });
    expect(link.send).not.toHaveBeenCalled();
  });

  it('sends a session.create the protocol accepts, with the launch as fields', async () => {
    const { adapter, link } = harness(true);
    const entity = session();
    const outcome = await adapter.create(entity, {
      ...NAMES,
      branch: 'oppenheimer/xrp-mobile/bold-otter-3f9a7k',
      prompt: 'Fix the wallet list empty state',
    });
    expect(outcome).toEqual({ delivered: true, hints: [] });
    const [message] = vi.mocked(link.send).mock.calls[0];
    const parsed = sessionCreateSchema.parse(message);
    expect(parsed.sessionId).toBe(entity.id);
    expect(parsed.organizationSlug).toBe('jordi');
    // The work folder's level under the account the host is paired with
    // (24 §2); the account itself is the pairing's, never the frame's.
    expect(parsed.workspaceId).toBe(ORG);
    expect(message).not.toHaveProperty('accountId');
    expect(parsed.sessionSlug).toBe('bold-otter-3f9a7k');
    expect(parsed.branch).toBe('oppenheimer/xrp-mobile/bold-otter-3f9a7k');
    expect(parsed.folder).toBeUndefined();
    // The conversation is the session's own id: it is what lets the agent's
    // transcript be reopened once the pane is gone.
    expect(parsed.launch).toEqual({ permission: 'ask', conversation: entity.id });
    expect(parsed.prompt).toBe('Fix the wallet list empty state');
    expect(parsed.checkouts).toEqual([
      expect.objectContaining({ githubRepoId: 42, repositoryFullName: 'acme/xrp-mobile' }),
    ]);
  });

  describe('a Codex cloud session', () => {
    const codexCloud = (environment: string | null) => {
      const entity = WorkSessionEntity.request({
        organizationId: ORG,
        projectId: PROJECT,
        createdByUserId: 'user-1',
        hostId: HOST,
        slug: 'bold-otter-3f9a7k',
        agent: 'codex',
        place: 'cloud',
      });
      entity.recordEvent({
        seq: 1,
        kind: 'session.requested',
        payload: { agent: 'codex', place: 'cloud', launch: { environment } },
        occurredAt: new Date(),
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
    };
    const spec = {
      ...NAMES,
      branch: 'oppenheimer/xrp-mobile/bold-otter-3f9a7k',
      prompt: 'Fix the wallet list',
      cloud: { sealed: 'c2VhbGVk', expiresAt: new Date('2026-10-31T13:00:00Z') },
    };

    // The person's pick rides the create, so the host starts the task there.
    it('names the environment the person picked', async () => {
      const { adapter, link } = harness(true, ['session.cloud.codex', 'codex.environments']);
      await adapter.create(codexCloud('e_6845a1b2c3d4'), spec);

      const parsed = sessionCreateSchema.parse(vi.mocked(link.send).mock.calls[0]?.[0]);
      expect(parsed.codexEnvironment).toBe('e_6845a1b2c3d4');
    });

    // None picked is the host's own pick: the environment linked to the repository.
    it('names none when nobody picked one', async () => {
      const { adapter, link } = harness(true, ['session.cloud.codex', 'codex.environments']);
      await adapter.create(codexCloud(null), spec);

      expect(vi.mocked(link.send).mock.calls[0]?.[0]).not.toHaveProperty('codexEnvironment');
    });
  });

  describe('a session in a folder on the host', () => {
    const inFolder = () =>
      WorkSessionEntity.request({
        organizationId: ORG,
        projectId: PROJECT,
        createdByUserId: 'user-1',
        hostId: HOST,
        slug: 'bold-otter-3f9a7k',
        agent: 'claude-code',
        place: 'folder',
        folder: '/home/jordi/notes',
      });

    it('sends the folder, and no branch and no checkouts, to a runner that takes it', async () => {
      const { adapter, link } = harness(true, ['session.folder']);
      const entity = inFolder();

      const outcome = await adapter.create(entity, NAMES);

      expect(outcome).toEqual({ delivered: true, hints: [] });
      const parsed = sessionCreateSchema.parse(vi.mocked(link.send).mock.calls[0]?.[0]);
      expect(parsed).toMatchObject({
        sessionId: entity.id,
        workspaceId: ORG,
        folder: '/home/jordi/notes',
        checkouts: [],
        cwdCheckoutId: null,
      });
      expect(parsed.branch).toBeUndefined();
    });

    it('sends nothing to a runner that did not say it takes one', async () => {
      // An older runner would refuse a create with no checkouts; the row stays
      // starting, and an updated runner's hello is sent it.
      const { adapter, link } = harness(true, ['session.image']);

      expect(await adapter.create(inFolder(), NAMES)).toEqual({
        delivered: false,
        hints: ['not_supported'],
      });
      expect(link.send).not.toHaveBeenCalled();
    });
  });

  it('names the workspace on a prepare', () => {
    const { adapter, link } = harness(true, ['repository.prepare']);

    const outcome = adapter.prepare(HOST, {
      workspaceId: ORG,
      githubRepoId: 42,
      repositoryFullName: 'acme/xrp-mobile',
      baseBranch: 'main',
      sealed: 'c2VhbGVk',
      expiresAt: new Date('2026-10-14T12:00:00Z'),
    });

    expect(outcome).toEqual({ delivered: true, hints: [] });
    const sent = repositoryPrepareSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]);
    expect(sent).toMatchObject({ workspaceId: ORG, githubRepoId: 42 });
  });

  it('sends a blank terminal with no permission level', async () => {
    const { adapter, link } = harness(true);
    await adapter.create(session('shell'), {
      ...NAMES,
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
      ...NAMES,
      branch: 'x',
    });
    expect(outcome).toEqual({ delivered: false, hints: ['not_supported'] });
    expect(link.send).not.toHaveBeenCalled();
  });

  it('types each key as its own session.input, in order, and stops at a link that drops', async () => {
    const { adapter, link } = harness(true);
    const entity = session();
    const outcome = await adapter.typeKeys(entity, {
      window: 0,
      keys: ['2', 'Icons', '\r'],
      gapMs: 0,
    });

    expect(outcome).toEqual({ delivered: true, hints: [] });
    const sent = vi
      .mocked(link.send)
      .mock.calls.map(([message]) => sessionInputSchema.parse(message));
    expect(sent.map((message) => Buffer.from(message.data, 'base64').toString('utf8'))).toEqual([
      '2',
      'Icons',
      '\r',
    ]);
    expect(sent.every((message) => message.sessionId === entity.id && message.window === 0)).toBe(
      true,
    );

    vi.mocked(link.send).mockClear().mockReturnValueOnce(true).mockReturnValueOnce(false);
    const dropped = await adapter.typeKeys(entity, { window: 0, keys: ['1', '2', '3'], gapMs: 0 });
    expect(dropped).toEqual({ delivered: false, hints: ['host_offline'] });
    expect(link.send).toHaveBeenCalledTimes(2);
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
      ...NAMES,
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
