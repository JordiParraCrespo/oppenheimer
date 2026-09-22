import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import type { SessionDispatchPort } from '../session-dispatch.port';
import { SessionLaunchSpecFactory } from '../session-launch.factory';
import { SessionReconciliationResolver } from '../session-reconciliation.resolver';

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';

function session(state: 'starting' | 'open'): WorkSessionEntity {
  const entity = WorkSessionEntity.request({
    organizationId: 'org',
    projectId: 'project',
    createdByUserId: 'user',
    hostId: HOST,
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
  });
  if (state === 'open') {
    entity.recordEvent({ seq: 2, kind: 'session.started', payload: {}, occurredAt: new Date() });
  }
  return entity;
}

function harness(rows: { session: WorkSessionEntity; projectSlug: string; prompt?: string }[]) {
  const sessions = {
    findUnresolvedForHostForMachine: vi.fn().mockResolvedValue(rows),
    appendEvents: vi.fn().mockResolvedValue({ accepted: ['k'], rejected: [], appended: [] }),
  } as unknown as WorkSessionRepositoryPort;
  const dispatch = {
    create: vi.fn().mockResolvedValue({ delivered: true, hints: [] }),
  } as unknown as SessionDispatchPort;
  const launches = new SessionLaunchSpecFactory({
    slugOf: vi.fn().mockResolvedValue('jordi'),
    isMember: vi.fn(),
  });
  return {
    sessions,
    dispatch,
    resolver: new SessionReconciliationResolver(sessions, dispatch, launches),
  };
}

describe('SessionReconciliationResolver', () => {
  it('dispatches again a launch the host never carried out, with its prompt', async () => {
    const owed = session('starting');
    const h = harness([{ session: owed, projectSlug: 'xrp', prompt: 'fix it' }]);
    const outcome = await h.resolver.reconcile(HOST, 'run-1', []);
    expect(outcome).toEqual({ redispatched: [owed.id], stopped: [] });
    expect(h.dispatch.create).toHaveBeenCalledWith(owed, {
      organizationSlug: 'jordi',
      projectSlug: 'xrp',
      branch: 'oppenheimer/xrp/bold-otter-3f9a7k',
      prompt: 'fix it',
    });
    expect(h.sessions.appendEvents).not.toHaveBeenCalled();
  });

  it('records stopped an open session the host no longer holds, keyed by the run', async () => {
    const lost = session('open');
    const h = harness([{ session: lost, projectSlug: 'xrp' }]);
    const outcome = await h.resolver.reconcile(HOST, 'run-1', []);
    expect(outcome).toEqual({ redispatched: [], stopped: [lost.id] });
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
    const h = harness([{ session: held, projectSlug: 'xrp' }]);
    const outcome = await h.resolver.reconcile(HOST, 'run-1', [held.id]);
    expect(outcome).toEqual({ redispatched: [], stopped: [] });
    expect(h.dispatch.create).not.toHaveBeenCalled();
    expect(h.sessions.appendEvents).not.toHaveBeenCalled();
  });
});
