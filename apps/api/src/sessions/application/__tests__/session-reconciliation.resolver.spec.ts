import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { SessionTerminalWatchRepositoryPort } from '../../database/session-terminal-watch.repository.port';
import type {
  HostSessionRow,
  WorkSessionRepositoryPort,
} from '../../database/work-session.repository.port';
import { SessionTerminalWatchEntity } from '../../domain/session-terminal-watch.entity';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import type { CloudFilesPort } from '../cloud-files.port';
import { CloudTaskFactory } from '../cloud-task.factory';
import type { SessionDispatchPort } from '../session-dispatch.port';
import { SessionLaunchSpecFactory } from '../session-launch.factory';
import type { SessionLaunchCredentials } from '../session-launch-credentials.resolver';
import { SessionReconciliationResolver } from '../session-reconciliation.resolver';

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';

function session(state: 'starting' | 'open', folder?: string, place?: 'cloud'): WorkSessionEntity {
  const entity = WorkSessionEntity.request({
    organizationId: 'org',
    projectId: 'project',
    createdByUserId: 'user',
    hostId: HOST,
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
    ...(folder ? { place: 'folder' as const, folder } : {}),
    ...(place ? { place } : {}),
  });
  if (state === 'open') {
    entity.recordEvent({ seq: 2, kind: 'session.started', payload: {}, occurredAt: new Date() });
  }
  return entity;
}

/** A session someone deleted: the close is on its log, folded as owed. */
function deleting(state: 'starting' | 'open', acceptUnpushedWork: boolean): WorkSessionEntity {
  const entity = session(state);
  entity.recordEvent({
    seq: 3,
    kind: 'session.close_requested',
    payload: { acceptUnpushedWork },
    occurredAt: new Date(),
  });
  return entity;
}

function harness(rows: HostSessionRow[], watches: SessionTerminalWatchEntity[] = []) {
  let minted = 0;
  const cloudFiles = {
    keep: vi.fn(),
    link: vi.fn(async () => `https://api.test/f/link-${++minted}`),
    sampleLink: () => '',
    open: vi.fn(),
  } satisfies CloudFilesPort;
  const sessions = {
    findUnresolvedForHostForMachine: vi.fn().mockResolvedValue(rows),
    appendEvents: vi.fn().mockResolvedValue({ accepted: ['k'], rejected: [], appended: [] }),
  } as unknown as WorkSessionRepositoryPort;
  const dispatch = {
    create: vi.fn().mockResolvedValue({ delivered: true, hints: [] }),
    close: vi.fn().mockResolvedValue({ delivered: true, hints: [] }),
    watchTerminal: vi.fn().mockResolvedValue({ delivered: true, hints: [] }),
  } as unknown as SessionDispatchPort;
  const terminalWatches = {
    findForSessions: vi.fn(async () => watches),
  } as unknown as SessionTerminalWatchRepositoryPort;
  const launches = new SessionLaunchSpecFactory(
    {
      slugOf: vi.fn().mockResolvedValue('jordi'),
      isMember: vi.fn(),
      ownedBy: vi.fn().mockResolvedValue([]),
    },
    { for: vi.fn().mockResolvedValue({}) } as unknown as SessionLaunchCredentials,
    new CloudTaskFactory(cloudFiles),
  );
  return {
    sessions,
    dispatch,
    resolver: new SessionReconciliationResolver(sessions, dispatch, launches, terminalWatches),
    terminalWatches,
  };
}

describe('SessionReconciliationResolver', () => {
  it('dispatches again a launch the host never carried out, with its prompt', async () => {
    const owed = session('starting');
    const h = harness([{ session: owed, prompt: 'fix it' }]);
    const outcome = await h.resolver.reconcile(HOST, 'run-1', []);
    expect(outcome).toEqual({ redispatched: [owed.id], stopped: [], reclosed: [] });
    expect(h.dispatch.create).toHaveBeenCalledWith(owed, {
      organizationSlug: 'jordi',
      workspaceId: 'org',
      branch: 'oppenheimer/bold-otter-3f9a7k',
      prompt: 'fix it',
    });
    expect(h.sessions.appendEvents).not.toHaveBeenCalled();
  });

  it('dispatches a folder session again with no branch of ours', async () => {
    // A folder runs on whatever branch it is on; naming one would be a branch
    // the runner has nothing to do with.
    const owed = session('starting', '/home/jordi/notes');
    const h = harness([{ session: owed }]);

    await h.resolver.reconcile(HOST, 'run-1', []);

    expect(h.dispatch.create).toHaveBeenCalledWith(owed, {
      organizationSlug: 'jordi',
      workspaceId: 'org',
    });
  });

  it('sends the first task’s images again with it, by the ids the log recorded', async () => {
    const owed = session('starting');
    const images = [{ imageId: 'parked-1', mediaType: 'image/png' as const }];
    const h = harness([{ session: owed, prompt: 'match this', images }]);

    await h.resolver.reconcile(HOST, 'run-1', []);

    expect(h.dispatch.create).toHaveBeenCalledWith(owed, expect.objectContaining({ images }));
  });

  it('links a cloud session’s files afresh in its task, never sending them as images', async () => {
    const owed = session('starting', undefined, 'cloud');
    const images = [{ imageId: 'kept-1', mediaType: 'image/png' as const }];
    const h = harness([{ session: owed, prompt: 'match this', images }]);

    await h.resolver.reconcile(HOST, 'run-1', []);

    const [, spec] = vi.mocked(h.dispatch.create).mock.calls[0];
    expect(spec.images).toBeUndefined();
    expect(spec.prompt).toContain("-o /tmp/attachments/1.png 'https://api.test/f/link-1'");
  });

  it('records stopped an open session the host no longer holds, keyed by the run', async () => {
    const lost = session('open');
    const h = harness([{ session: lost }]);
    const outcome = await h.resolver.reconcile(HOST, 'run-1', []);
    expect(outcome).toEqual({ redispatched: [], stopped: [lost.id], reclosed: [] });
    expect(h.sessions.appendEvents).toHaveBeenCalledWith(lost, [
      expect.objectContaining({
        kind: 'session.stopped',
        idempotencyKey: 'session.stopped:hello-run-1',
        source: 'api',
      }),
    ]);
  });

  it('leaves alone what the host holds, and what is already stopped', async () => {
    const held = session('open');
    const stopped = session('open');
    stopped.recordEvent({ seq: 3, kind: 'session.stopped', payload: {}, occurredAt: new Date() });
    const h = harness([{ session: held }, { session: stopped }]);
    const outcome = await h.resolver.reconcile(HOST, 'run-1', [held.id]);
    expect(outcome).toEqual({ redispatched: [], stopped: [], reclosed: [] });
    expect(h.dispatch.create).not.toHaveBeenCalled();
    expect(h.sessions.appendEvents).not.toHaveBeenCalled();
  });

  it('sends a close still owed again with its acceptUnpushedWork, held or not, and records the lost pane stopped', async () => {
    // The close went out while the link was down, or on a link that dropped:
    // without this it is never sent again and the session sits stopped for good.
    const lost = deleting('open', true);
    const held = deleting('open', false);
    const h = harness([{ session: lost }, { session: held }]);

    const outcome = await h.resolver.reconcile(HOST, 'run-1', [held.id]);

    expect(outcome).toEqual({ redispatched: [], stopped: [lost.id], reclosed: [lost.id, held.id] });
    expect(h.dispatch.close).toHaveBeenCalledWith(lost, { acceptUnpushedWork: true });
    expect(h.dispatch.close).toHaveBeenCalledWith(held, { acceptUnpushedWork: false });
    expect(h.dispatch.create).not.toHaveBeenCalled();
  });

  it('closes a session deleted before its host built it, instead of building it', async () => {
    const owed = deleting('starting', false);
    const h = harness([{ session: owed, prompt: 'fix it' }]);

    const outcome = await h.resolver.reconcile(HOST, 'run-1', []);

    expect(outcome).toEqual({ redispatched: [], stopped: [], reclosed: [owed.id] });
    expect(h.dispatch.create).not.toHaveBeenCalled();
    expect(h.dispatch.close).toHaveBeenCalledWith(owed, { acceptUnpushedWork: false });
  });

  it('sends a failed session its owed close, and records nothing else about it', async () => {
    // A person may delete a failed session; its close is lost with the link
    // like any other, so the hello reads failed rows too.
    const failed = session('open');
    failed.recordEvent({ seq: 3, kind: 'session.failed', payload: {}, occurredAt: new Date() });
    failed.recordEvent({
      seq: 4,
      kind: 'session.close_requested',
      payload: { acceptUnpushedWork: false },
      occurredAt: new Date(),
    });
    const h = harness([{ session: failed }]);

    const outcome = await h.resolver.reconcile(HOST, 'run-1', []);

    expect(outcome).toEqual({ redispatched: [], stopped: [], reclosed: [failed.id] });
    expect(h.sessions.appendEvents).not.toHaveBeenCalled();
    expect(h.dispatch.create).not.toHaveBeenCalled();
  });

  it('sends nothing for a close the host refused or a restart superseded', async () => {
    const refused = deleting('open', false);
    refused.recordEvent({
      seq: 4,
      kind: 'command.failed',
      payload: { command: 'session.close', code: 'GIT_003' },
      occurredAt: new Date(),
    });
    const restarted = deleting('open', false);
    restarted.recordEvent({
      seq: 4,
      kind: 'session.restart_requested',
      payload: {},
      occurredAt: new Date(),
    });
    const h = harness([{ session: refused }, { session: restarted }]);

    await h.resolver.reconcile(HOST, 'run-1', [refused.id, restarted.id]);

    expect(h.dispatch.close).not.toHaveBeenCalled();
  });

  it('counts a close that found no link as not sent again', async () => {
    const owed = deleting('open', false);
    const h = harness([{ session: owed }]);
    vi.mocked(h.dispatch.close).mockResolvedValue({ delivered: false, hints: ['host_offline'] });

    const outcome = await h.resolver.reconcile(HOST, 'run-1', [owed.id]);

    expect(outcome.reclosed).toEqual([]);
  });

  it('sends the watches of the live sessions a host holds again, since a runner keeps them in memory', async () => {
    const held = session('open');
    const gone = session('open');
    const watch = SessionTerminalWatchEntity.watch({
      organizationId: 'org',
      sessionId: held.id,
      pattern: 'FAIL',
    });
    const h = harness([{ session: held }, { session: gone }], [watch]);

    await h.resolver.reconcile(HOST, 'run-1', [held.id]);

    // Only the sessions the host holds: one it lost is recorded stopped, not watched.
    expect(h.terminalWatches.findForSessions).toHaveBeenCalledWith('org', [held.id]);
    expect(h.dispatch.watchTerminal).toHaveBeenCalledWith(held, {
      watchId: watch.id,
      pattern: 'FAIL',
    });
  });
});
