import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectEntity } from '../../../../projects/domain/project.entity';
import type { SessionDispatchPort } from '../../../application/session-dispatch.port';
import type { SessionPlanFactory } from '../../../application/session-plan.factory';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
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
  agent: 'claude-code' as const,
  checkouts: [{ installationId: 'installation-1', githubRepoId: 42 }],
};

function project() {
  return ProjectEntity.createNew({
    organizationId: 'org-acme',
    name: 'xrp-mobile',
    slug: 'xrp-mobile',
    originGithubRepoId: '42',
  });
}

describe('CreateSessionCommandHandler', () => {
  let sessions: WorkSessionRepositoryPort;
  let hosts: { assertUsable: ReturnType<typeof vi.fn> };
  let dispatch: SessionDispatchPort;
  let plan: SessionPlanFactory;
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
    hosts = { assertUsable: vi.fn().mockResolvedValue(undefined) };
    dispatch = {
      create: vi.fn().mockResolvedValue({ delivered: false, hints: [] }),
    } as unknown as SessionDispatchPort;
    plan = {
      resolveProject: vi.fn().mockResolvedValue(project()),
      attachCheckout: vi.fn().mockResolvedValue(undefined),
      cwdCheckoutIdFor: vi.fn().mockReturnValue(null),
    } as unknown as SessionPlanFactory;

    handler = new CreateSessionCommandHandler(sessions, hosts, dispatch, plan);
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
