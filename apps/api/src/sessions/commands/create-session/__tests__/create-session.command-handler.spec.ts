import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostAccessPort } from '../../../../hosts/application/host-access.port';
import { ProjectEntity } from '../../../../projects/domain/project.entity';
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
 * The create path's three refusals and its one retry, which is the whole of what
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
  });
}

describe('CreateSessionCommandHandler', () => {
  let sessions: WorkSessionRepositoryPort;
  let hosts: { assertUsable: ReturnType<typeof vi.fn> };
  let dispatch: SessionDispatchPort;
  let plan: SessionPlanFactory;
  let naming: { propose: ReturnType<typeof vi.fn>; record: ReturnType<typeof vi.fn> };
  let handler: CreateSessionCommandHandler;

  beforeEach(() => {
    sessions = {
      findOneByIdempotencyKey: vi.fn().mockResolvedValue(None),
      createIfUnclaimed: vi.fn().mockImplementation(async (session: WorkSessionEntity) => ({
        session,
        created: true,
        projectArchived: false,
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

    handler = new CreateSessionCommandHandler(
      sessions,
      hosts as unknown as HostAccessPort,
      dispatch,
      plan,
      launches(),
      naming as unknown as SessionNamingResolver,
      new WorkSessionMapper(),
    );
  });

  const command = (
    overrides: Partial<ConstructorParameters<typeof CreateSessionCommand>[0]> = {},
  ) =>
    new CreateSessionCommand({
      scope: SCOPE,
      userId: 'user-1',
      input: INPUT,
      idempotencyKey: 'key-1',
      ...overrides,
    });

  it('mints a slug, records the request and the cwd, and dispatches the job', async () => {
    const { session, hints } = await handler.execute(command());

    expect(session.slug).toMatch(/^[a-z]+-[a-z]+-[0-9a-z]{6}$/);
    expect(session.state).toBe('starting');
    // Two entries, one transaction, one action: the request and where the agent
    // runs. The second is an event because `cwdCheckoutId` is part of the fold.
    const [, events] = vi.mocked(sessions.createIfUnclaimed).mock.calls[0];
    expect(events.map((event) => event.kind)).toEqual(['session.requested', 'session.cwd_set']);
    expect(events.every((event) => event.source === 'api')).toBe(true);
    expect(dispatch.create).toHaveBeenCalledOnce();
    // Nothing reached a host, and the response says so rather than a second log
    // entry saying it.
    expect(hints).toEqual([]);
  });

  it('carries the dispatcher’s hints back on the response', async () => {
    vi.mocked(dispatch.create).mockResolvedValue({ delivered: false, hints: ['host_offline'] });

    await expect(handler.execute(command())).resolves.toMatchObject({ hints: ['host_offline'] });
    // And appends nothing for it: one action is one entry, and "we could not reach
    // the host just now" is about this request, not about the session's history.
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
      projectArchived: true,
    });

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'SESSIONS_006' });
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

    await expect(handler.execute(command())).resolves.toMatchObject({ session: existing });
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
      projectArchived: false,
    });

    await expect(handler.execute(command())).resolves.toMatchObject({ session: other });
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
});

/**
 * The composer's foot row and its first task, which is what the create request
 * grew for the New session screen (`product/versions/mvp/03-control-plane.md`).
 *
 * All three assertions are about the same rule from different sides: the launch
 * is *stated in the log*, because the columns that carry it are a projection of
 * that log and writing them any other way would be a second truth.
 */
describe('CreateSessionCommandHandler: the launch and the first task', () => {
  let sessions: WorkSessionRepositoryPort;
  let dispatch: SessionDispatchPort;
  let naming: { propose: ReturnType<typeof vi.fn>; record: ReturnType<typeof vi.fn> };
  let handler: CreateSessionCommandHandler;

  beforeEach(() => {
    sessions = {
      findOneByIdempotencyKey: vi.fn().mockResolvedValue(None),
      createIfUnclaimed: vi.fn().mockImplementation(async (session: WorkSessionEntity) => ({
        session,
        created: true,
        projectArchived: false,
      })),
    } as unknown as WorkSessionRepositoryPort;
    dispatch = {
      create: vi.fn().mockResolvedValue({ delivered: false, hints: [] }),
    } as unknown as SessionDispatchPort;
    naming = {
      propose: vi.fn().mockResolvedValue(null),
      record: vi.fn().mockResolvedValue(undefined),
    };
    handler = new CreateSessionCommandHandler(
      sessions,
      {
        assertUsable: vi.fn().mockResolvedValue({ probedTools: null }),
      } as unknown as HostAccessPort,
      dispatch,
      {
        resolveProject: vi.fn().mockResolvedValue(project()),
        attachCheckout: vi.fn().mockResolvedValue(undefined),
        cwdCheckoutIdFor: vi.fn().mockReturnValue(null),
      } as unknown as SessionPlanFactory,
      launches(),
      naming as unknown as SessionNamingResolver,
      new WorkSessionMapper(),
    );
  });

  const run = (input: Record<string, unknown>) =>
    handler.execute(
      new CreateSessionCommand({
        scope: SCOPE,
        userId: 'user-1',
        input: { ...INPUT, ...input } as never,
        idempotencyKey: null,
      }),
    );

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
    await run({ launch: { model: 'opus', permission: 'auto', effort: 'high' } });

    expect(requestPayload().launch).toEqual({
      model: 'opus',
      permission: 'auto',
      effort: 'high',
    });
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
    expect(naming.record).toHaveBeenCalledWith(expect.anything(), proposal, prompt?.idempotencyKey);
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
