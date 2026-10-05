import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostAccessPort } from '../../../../hosts/application/host-access.port';
import type {
  LinkRegistryPort,
  RunnerLink,
} from '../../../../links/application/link-registry.port';
import type { ParkedFilePort, StagedFile } from '../../../../links/application/parked-file.port';
import { ProjectEntity } from '../../../../projects/domain/project.entity';
import { SessionAttachmentsResolver } from '../../../application/session-attachments.resolver';
import type { SessionDispatchPort } from '../../../application/session-dispatch.port';
import { SessionLaunchSpecFactory } from '../../../application/session-launch.factory';
import type { SessionNamingResolver } from '../../../application/session-naming.resolver';
import type { SessionPlanFactory } from '../../../application/session-plan.factory';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { WorkSessionMapper } from '../../../work-session.mapper';
import { CreateSessionCommand } from '../create-session.command';
import { CreateSessionCommandHandler } from '../create-session.command-handler';

/**
 * The create path's refusals and its one retry, which is the whole of what
 * this handler decides. Everything else — the directory name, the branch, the
 * repository's own name — belongs to the factory and is tested where it lives.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

const INPUT = {
  hostId: 'host-1',
  projectId: 'project-1',
  agent: 'claude-code' as const,
  checkouts: [{ installationId: 'installation-1', githubRepoId: 42 }],
};

function project() {
  return ProjectEntity.createNew({
    organizationId: 'org-acme',
    name: 'xrp-mobile',
    slug: 'xrp-mobile',
    repositories: [
      {
        installationId: 'installation-1',
        githubRepoId: '42',
        repositoryFullName: 'acme/xrp-mobile',
        baseBranch: 'main',
        isDefault: true,
      },
    ],
  });
}

function launches(): SessionLaunchSpecFactory {
  return new SessionLaunchSpecFactory({
    slugOf: vi.fn().mockResolvedValue('jordi'),
    isMember: vi.fn(),
    ownedBy: vi.fn().mockResolvedValue([]),
  });
}

/** The image store in memory: staged uploads by id, checked against their owner as the adapter does. */
function imageStore(uploads: Record<string, StagedFile> = {}) {
  const staged = new Map(Object.entries(uploads));
  let next = 0;
  const read = (ids: readonly string[], owner: { organizationId: string; userId: string }) => {
    const found = ids.map((id) => staged.get(id));
    return found.every(
      (image) => image?.organizationId === owner.organizationId && image.userId === owner.userId,
    )
      ? (found as StagedFile[])
      : undefined;
  };
  return {
    park: vi.fn(),
    stage: vi.fn(),
    claim: vi.fn(async (ids: readonly string[], owner) =>
      read(ids, owner)?.map((image) => ({
        imageId: `parked-${++next}`,
        mediaType: image.mediaType,
      })),
    ),
    collect: vi.fn(),
  } satisfies ParkedFilePort;
}

/** The link registry: the host linked with these capabilities, or not linked at all. */
function linksWith(capabilities: RunnerLink['capabilities'] | null): LinkRegistryPort {
  return {
    register: vi.fn(),
    unregister: vi.fn(),
    nextEpoch: vi.fn(),
    find: vi.fn(() => (capabilities ? ({ capabilities } as unknown as RunnerLink) : undefined)),
  };
}

describe('CreateSessionCommandHandler', () => {
  let sessions: WorkSessionRepositoryPort;
  let hosts: { assertUsable: ReturnType<typeof vi.fn> };
  let dispatch: SessionDispatchPort;
  let plan: SessionPlanFactory;
  let naming: { propose: ReturnType<typeof vi.fn>; record: ReturnType<typeof vi.fn> };
  let store: ReturnType<typeof imageStore>;
  let links: LinkRegistryPort;
  let handler: CreateSessionCommandHandler;

  beforeEach(() => {
    store = imageStore();
    links = linksWith(['session.image', 'session.create.images']);
    sessions = {
      findOneByIdempotencyKey: vi.fn().mockResolvedValue(None),
      createIfUnclaimed: vi.fn().mockImplementation(async (session: WorkSessionEntity) => ({
        session,
        created: true,
        refused: null,
      })),
    } as unknown as WorkSessionRepositoryPort;
    hosts = { assertUsable: vi.fn().mockResolvedValue({ probedTools: null }) };
    dispatch = {
      create: vi.fn().mockResolvedValue({ delivered: false, hints: [] }),
    } as unknown as SessionDispatchPort;
    plan = {
      resolveProject: vi.fn().mockResolvedValue(project()),
      attachCheckout: vi.fn().mockResolvedValue(undefined),
      cwdCheckoutIdFor: vi.fn().mockReturnValue(null),
    } as unknown as SessionPlanFactory;

    naming = {
      propose: vi.fn().mockResolvedValue(null),
      record: vi.fn().mockResolvedValue(undefined),
    };

    handler = rebuild();
  });

  /** The handler over the current fakes; a test that swaps the store or the link calls it again. */
  function rebuild() {
    return new CreateSessionCommandHandler(
      sessions,
      hosts as unknown as HostAccessPort,
      dispatch,
      plan,
      launches(),
      naming as unknown as SessionNamingResolver,
      new WorkSessionMapper(),
      new SessionAttachmentsResolver(store, links),
    );
  }

  const command = (
    overrides: Partial<ConstructorParameters<typeof CreateSessionCommand>[0]> = {},
  ) =>
    new CreateSessionCommand({
      scope: SCOPE,
      userId: 'user-1',
      input: INPUT,
      idempotencyKey: 'key-1',
      origin: 'person',
      ...overrides,
    });

  it('mints a slug, records the request and the cwd, and dispatches the job', async () => {
    const { sessionId, hints } = await handler.execute(command());
    const [session] = vi.mocked(sessions.createIfUnclaimed).mock.calls[0];

    expect(sessionId).toBe(session.id);
    expect(session.slug).toMatch(/^[a-z]+-[a-z]+-[0-9a-z]{6}$/);
    expect(session.state).toBe('starting');
    // Two entries, one transaction, one action: the request and where the agent
    // runs. The second is an event because `cwdCheckoutId` is part of the fold.
    const [, events] = vi.mocked(sessions.createIfUnclaimed).mock.calls[0];
    expect(events.map((event) => event.kind)).toEqual(['session.requested', 'session.cwd_set']);
    expect(events.every((event) => event.source === 'api')).toBe(true);
    expect(dispatch.create).toHaveBeenCalledOnce();
    // An undelivered job is never a second log entry; the response carries only
    // the hints the dispatcher raised, here none.
    expect(hints).toEqual([]);
  });

  it('carries the dispatcher’s hints back on the response', async () => {
    vi.mocked(dispatch.create).mockResolvedValue({ delivered: false, hints: ['host_offline'] });

    await expect(handler.execute(command())).resolves.toMatchObject({ hints: ['host_offline'] });
    // And appends nothing for it: "we could not reach the host just now" is about
    // this request, not about the session's history.
    expect(vi.mocked(sessions.createIfUnclaimed).mock.calls[0][1]).toHaveLength(2);
  });

  it('refuses when the project was archived while it was being planned', async () => {
    // The project row is locked inside the insert transaction, so this is the race
    // decided rather than detected afterwards.
    vi.mocked(sessions.createIfUnclaimed).mockResolvedValue({
      session: WorkSessionEntity.request({
        organizationId: 'org-acme',
        projectId: 'project-1',
        createdByUserId: 'user-1',
        hostId: 'host-1',
        slug: 'bold-otter-3f9a7k',
        agent: 'claude-code',
      }),
      created: false,
      refused: 'project-archived',
    });

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'SESSIONS_006' });
    expect(dispatch.create).not.toHaveBeenCalled();
  });

  it('refuses when the host was unpaired while it was being planned', async () => {
    vi.mocked(sessions.createIfUnclaimed).mockResolvedValue({
      session: WorkSessionEntity.request({
        organizationId: 'org-acme',
        projectId: 'project-1',
        createdByUserId: 'user-1',
        hostId: 'host-1',
        slug: 'bold-otter-3f9a7k',
        agent: 'claude-code',
      }),
      created: false,
      refused: 'host-unpaired',
    });

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_001' });
    expect(dispatch.create).not.toHaveBeenCalled();
  });

  it('returns the session a retry already created, and asks nobody anything', async () => {
    const existing = WorkSessionEntity.request({
      organizationId: 'org-acme',
      projectId: 'project-1',
      createdByUserId: 'user-1',
      hostId: 'host-1',
      slug: 'bold-otter-3f9a7k',
      agent: 'claude-code',
      idempotencyKey: 'key-1',
    });
    vi.mocked(sessions.findOneByIdempotencyKey).mockResolvedValue(Some(existing));

    await expect(handler.execute(command())).resolves.toMatchObject({ sessionId: existing.id });
    // The point of the key: no second directory, no second branch, and no second
    // trip to GitHub or to the host.
    expect(hosts.assertUsable).not.toHaveBeenCalled();
    expect(sessions.createIfUnclaimed).not.toHaveBeenCalled();
    expect(dispatch.create).not.toHaveBeenCalled();
  });

  it('does not dispatch again when the insert lost the race', async () => {
    const other = WorkSessionEntity.request({
      organizationId: 'org-acme',
      projectId: 'project-1',
      createdByUserId: 'user-1',
      hostId: 'host-1',
      slug: 'quiet-heron-b210c4',
      agent: 'claude-code',
      idempotencyKey: 'key-1',
    });
    vi.mocked(sessions.createIfUnclaimed).mockResolvedValue({
      session: other,
      created: false,
      refused: null,
    });

    await expect(handler.execute(command())).resolves.toMatchObject({ sessionId: other.id });
    expect(dispatch.create).not.toHaveBeenCalled();
  });

  it('refuses a host the caller cannot use, before writing anything', async () => {
    // `hostId` is the one reference in the schema a constraint cannot hold, so this
    // check is the constraint. It has to run before the first insert.
    hosts.assertUsable.mockRejectedValue(
      new AppError({ code: 'HOSTS_001', message: 'Host not found', httpStatus: 404 }),
    );

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_001' });
    expect(sessions.createIfUnclaimed).not.toHaveBeenCalled();
  });

  it('refuses an agent the host runner was built without, before writing anything', async () => {
    // A runner from before Grok probes no `grok`, and would fail the launch as an
    // unknown agent after the session was recorded.
    hosts.assertUsable.mockResolvedValue({
      probedTools: ['git', 'tmux', 'claude', 'codex', 'opencode'],
    });
    const grok = command({ input: { ...INPUT, agent: 'grok' } });

    await expect(handler.execute(grok)).rejects.toMatchObject({ code: 'SESSIONS_011' });
    expect(sessions.createIfUnclaimed).not.toHaveBeenCalled();
    expect(dispatch.create).not.toHaveBeenCalled();
  });

  describe('attached images', () => {
    const upload = (userId = 'user-1'): StagedFile => ({
      organizationId: 'org-acme',
      userId,
      mediaType: 'image/png',
      data: Buffer.from('png'),
    });
    const attached = (ids: string[]) =>
      command({ input: { ...INPUT, prompt: 'look at this', attachmentIds: ids } });

    it('parks the uploads for this session before the row, and records their ids', async () => {
      store = imageStore({ 'a-1': upload(), 'a-2': upload() });
      // The resolver reads `store` when called, so rebuild the handler around it.
      handler = rebuild();

      await handler.execute(attached(['a-1', 'a-2']));

      const [session, events] = vi.mocked(sessions.createIfUnclaimed).mock.calls[0];
      expect(store.claim).toHaveBeenCalledWith(
        ['a-1', 'a-2'],
        { organizationId: 'org-acme', userId: 'user-1' },
        { hostId: 'host-1', sessionId: session.id },
      );
      const images = [
        { imageId: 'parked-1', mediaType: 'image/png' },
        { imageId: 'parked-2', mediaType: 'image/png' },
      ];
      // The log keeps the ids, so a create sent again after a reconnect names them.
      expect(events.find((event) => event.kind === 'prompt.first')?.payload).toEqual({
        text: 'look at this',
        images,
      });
      const [, spec] = vi.mocked(dispatch.create).mock.calls[0];
      expect(spec.images).toEqual(images);
    });

    it('refuses an upload that is not the caller’s, before writing anything', async () => {
      store = imageStore({ 'a-1': upload('someone-else') });
      handler = rebuild();

      await expect(handler.execute(attached(['a-1']))).rejects.toMatchObject({
        code: 'SESSIONS_019',
      });
      expect(sessions.createIfUnclaimed).not.toHaveBeenCalled();
    });

    it('refuses a host that cannot take them now, before parking or writing anything', async () => {
      store = imageStore({ 'a-1': upload() });
      links = linksWith(null);
      handler = rebuild();
      await expect(handler.execute(attached(['a-1']))).rejects.toMatchObject({
        code: 'SESSIONS_016',
      });

      links = linksWith(['session.image']);
      handler = rebuild();
      await expect(handler.execute(attached(['a-1']))).rejects.toMatchObject({
        code: 'SESSIONS_017',
      });
      expect(store.claim).not.toHaveBeenCalled();
      expect(sessions.createIfUnclaimed).not.toHaveBeenCalled();
    });

    it('refuses a PDF for a runner that takes images only, before writing anything', async () => {
      store = imageStore({
        'a-1': upload(),
        'a-2': { ...upload(), mediaType: 'application/pdf', data: Buffer.from('%PDF-1.7') },
      });
      handler = rebuild();
      await expect(handler.execute(attached(['a-1', 'a-2']))).rejects.toMatchObject({
        code: 'SESSIONS_017',
      });
      expect(sessions.createIfUnclaimed).not.toHaveBeenCalled();

      links = linksWith(['session.image', 'session.create.images', 'session.files']);
      handler = rebuild();
      await handler.execute(attached(['a-1', 'a-2']));
      const [, spec] = vi.mocked(dispatch.create).mock.calls[0];
      expect(spec.images?.map((image) => image.mediaType)).toEqual([
        'image/png',
        'application/pdf',
      ]);
    });

    it('asks nothing of the host when nothing is attached', async () => {
      links = linksWith(null);
      handler = rebuild();

      await handler.execute(command());

      expect(store.claim).not.toHaveBeenCalled();
      expect(vi.mocked(dispatch.create).mock.calls[0][1].images).toBeUndefined();
    });
  });

  it('refuses when the project the repository belongs to is archived', async () => {
    vi.mocked(plan.resolveProject).mockRejectedValue(
      new AppError({ code: 'PROJECTS_004', message: 'That project is archived', httpStatus: 409 }),
    );

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'PROJECTS_004' });
    expect(sessions.createIfUnclaimed).not.toHaveBeenCalled();
  });

  it('refuses a caller with no active workspace', async () => {
    await expect(
      handler.execute(command({ scope: { ...SCOPE, organizationId: null } })),
    ).rejects.toMatchObject({ code: 'SESSIONS_002' });
  });

  /**
   * The composer's foot row and its first task, which is what the create request
   * grew for the New session screen (`product/versions/mvp/03-control-plane.md`).
   *
   * The launch assertions are about the same rule from different sides: the launch
   * is *stated in the log*, because the columns that carry it are a projection of
   * that log and writing them any other way would be a second truth.
   */
  describe('the launch and the first task', () => {
    const run = (input: Record<string, unknown>) =>
      handler.execute(command({ input: { ...INPUT, ...input } as never, idempotencyKey: null }));

    function requestPayload() {
      const [, events] = vi.mocked(sessions.createIfUnclaimed).mock.calls[0];
      const requested = events.find((event) => event.kind === 'session.requested');
      return requested?.payload as { launch?: Record<string, unknown> };
    }

    // What the handler owes is the *statement* in the log; the columns follow from
    // it when the repository folds the batch, which is asserted against the fold
    // itself in `__tests__/session-state.spec.ts` rather than through a mock that
    // would only prove the mock records what it was handed.
    it('states the launch in the log, where the columns are folded from', async () => {
      await run({ launch: { model: 'claude-opus-5-5', permission: 'auto', effort: 'high' } });

      expect(requestPayload().launch).toEqual({
        model: 'claude-opus-5-5',
        permission: 'auto',
        effort: 'high',
      });
    });

    // The levels are the model's: the runner drops one the model lacks, so the
    // record does not name a level nothing ran at.
    it('records no effort the model does not offer', async () => {
      await run({ launch: { model: 'claude-haiku-4-5', effort: 'high' } });
      expect(requestPayload().launch?.effort).toBeNull();

      vi.mocked(sessions.createIfUnclaimed).mockClear();
      await run({ launch: { model: 'claude-opus-5-5', effort: 'ultra' } });
      expect(requestPayload().launch?.effort).toBeNull();
    });

    it('defaults to the level that asks, never to one that escalates', async () => {
      await run({});

      expect(requestPayload().launch).toEqual({ model: null, permission: 'ask', effort: null });
    });

    it('records the first task as prompt.first and sends it with the launch', async () => {
      await run({ prompt: 'Fix the wallet list empty state' });

      const [, events] = vi.mocked(sessions.createIfUnclaimed).mock.calls[0];
      const prompt = events.find((event) => event.kind === 'prompt.first');
      expect(prompt?.source).toBe('api');
      expect(prompt?.payload).toEqual({ text: 'Fix the wallet list empty state' });

      // It rides the launch rather than a second message, so the host gives it to
      // the agent once the agent is up rather than racing it.
      const [, spec] = vi.mocked(dispatch.create).mock.calls[0];
      expect(spec.prompt).toBe('Fix the wallet list empty state');
    });

    it('names the session from that task, keyed on the entry that carried it', async () => {
      const proposal = { name: 'Wallet list empty state', source: 'model' };
      naming.propose.mockResolvedValue(proposal);

      await run({ prompt: 'Fix the wallet list empty state' });

      const [, events] = vi.mocked(sessions.createIfUnclaimed).mock.calls[0];
      const prompt = events.find((event) => event.kind === 'prompt.first');
      expect(naming.propose).toHaveBeenCalledWith(
        expect.anything(),
        'Fix the wallet list empty state',
      );
      expect(naming.record).toHaveBeenCalledWith(
        expect.anything(),
        proposal,
        prompt?.idempotencyKey,
      );
    });

    it('asks for the name while the host is told, and answers once it has one', async () => {
      // The model's round trip overlaps the dispatch rather than following it, and
      // the create waits for the proposal — which the resolver bounds by its
      // deadline — so the response carries the name.
      let answer: (value: unknown) => void = () => {};
      naming.propose.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );

      const pending = run({ prompt: 'Fix the wallet list empty state' });
      await vi.waitFor(() => expect(dispatch.create).toHaveBeenCalled());
      expect(naming.record).not.toHaveBeenCalled();

      answer({ name: 'Fix the wallet list empty state', source: 'prompt' });
      await pending;
      expect(naming.record).toHaveBeenCalledTimes(1);
    });

    it('writes no prompt entry and names nothing when the composer was empty', async () => {
      await run({});

      const [, events] = vi.mocked(sessions.createIfUnclaimed).mock.calls[0];
      expect(events.some((event) => event.kind === 'prompt.first')).toBe(false);
      expect(naming.propose).not.toHaveBeenCalled();
    });
  });
});
