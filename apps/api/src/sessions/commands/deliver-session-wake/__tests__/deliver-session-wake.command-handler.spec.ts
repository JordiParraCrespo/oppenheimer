import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { SessionDispatchPort } from '../../../application/session-dispatch.port';
import { SessionPromptTyperResolver } from '../../../application/session-prompt-typer.resolver';
import type { SessionWake, SessionWakesPort } from '../../../application/session-wakes.port';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../../domain/session-state.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { DeliverSessionWakeCommand } from '../deliver-session-wake.command';
import {
  DeliverSessionWakeCommandHandler,
  WAKE_MAX_ATTEMPTS,
} from '../deliver-session-wake.command-handler';

/**
 * A wake reaches the agent as a prompt from `{ kind: 'wake' }` once the agent
 * is at its prompt, keyed by the wake so a retry never types it twice; a busy
 * agent is asked again a minute later, until it has been asked for four
 * hours; a session that is no longer open drops it.
 */

function sessionAt(observed: string | null, stopped = false) {
  const session = WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'swift-wren-7gyezw',
    agent: 'claude-code',
  });
  session.recordEvents([
    { seq: 1, kind: SESSION_EVENT_KINDS.STARTED, payload: {}, occurredAt: new Date() },
    ...(observed
      ? [
          {
            seq: 2,
            kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
            payload: { state: observed },
            occurredAt: new Date(),
          },
        ]
      : []),
    ...(stopped
      ? [{ seq: 3, kind: SESSION_EVENT_KINDS.STOPPED, payload: {}, occurredAt: new Date() }]
      : []),
  ]);
  return session;
}

function harness(found: WorkSessionEntity | null, { claimedBefore = false } = {}) {
  const sessions = {
    findOneByIdForMachine: vi.fn().mockResolvedValue(found ? Some(found) : None),
    appendEvents: vi.fn().mockResolvedValue({ accepted: [], rejected: [], appended: [] }),
    appendEventsIf: vi
      .fn()
      .mockImplementation(async (session: WorkSessionEntity, _events, holds) =>
        holds(session.fold, session.latestTurn)
          ? { accepted: [], rejected: [], appended: claimedBefore ? [] : [{ seq: 9 }] }
          : null,
      ),
  } as unknown as WorkSessionRepositoryPort;
  const dispatch = {
    typeKeys: vi.fn().mockResolvedValue({ delivered: true, hints: [] }),
  } as unknown as SessionDispatchPort;
  const wakes = { schedule: vi.fn().mockResolvedValue(undefined) } as unknown as SessionWakesPort;
  const handler = new DeliverSessionWakeCommandHandler(
    sessions,
    wakes,
    new SessionPromptTyperResolver(sessions, dispatch),
  );
  return { handler, sessions, dispatch, wakes };
}

const wake = (overrides: Partial<SessionWake> = {}): SessionWake => ({
  sessionId: 's-1',
  wakeId: 'gh-evt-1',
  source: 'github',
  text: '<oppenheimer from="github">Pull request #12: checks passed.</oppenheimer>',
  attempt: 0,
  ...overrides,
});

describe('DeliverSessionWakeCommandHandler', () => {
  it('types the line as a prompt from the wake, claimed by the wake', async () => {
    const { handler, sessions, dispatch, wakes } = harness(sessionAt('idle'));
    await handler.execute(new DeliverSessionWakeCommand({ wake: wake() }));
    const [, events] = vi.mocked(sessions.appendEventsIf).mock.calls[0] ?? [];
    expect(events).toEqual([
      expect.objectContaining({
        idempotencyKey: 'prompt.sent:wake-gh-evt-1',
        payload: {
          text: wake().text,
          sender: { kind: 'wake', source: 'github', wakeId: 'gh-evt-1' },
        },
      }),
    ]);
    expect(dispatch.typeKeys).toHaveBeenCalledOnce();
    expect(wakes.schedule).not.toHaveBeenCalled();
  });

  // The regression: a retried job typing the same wake into the agent twice.
  it('types nothing when an earlier attempt already claimed the wake', async () => {
    const { handler, dispatch, wakes } = harness(sessionAt('idle'), { claimedBefore: true });
    await handler.execute(new DeliverSessionWakeCommand({ wake: wake() }));
    expect(dispatch.typeKeys).not.toHaveBeenCalled();
    expect(wakes.schedule).not.toHaveBeenCalled();
  });

  it('asks a working agent again a minute later, and gives up after four hours', async () => {
    const busy = harness(sessionAt('working'));
    const before = Date.now();
    await busy.handler.execute(new DeliverSessionWakeCommand({ wake: wake({ attempt: 3 }) }));
    expect(busy.dispatch.typeKeys).not.toHaveBeenCalled();
    const [again, at] = vi.mocked(busy.wakes.schedule).mock.calls[0] ?? [];
    expect(again).toMatchObject({ wakeId: 'gh-evt-1', attempt: 4 });
    expect((at as Date).getTime()).toBeGreaterThanOrEqual(before + 59_000);

    const tired = harness(sessionAt('working'));
    await tired.handler.execute(
      new DeliverSessionWakeCommand({ wake: wake({ attempt: WAKE_MAX_ATTEMPTS - 1 }) }),
    );
    expect(tired.wakes.schedule).not.toHaveBeenCalled();
  });

  it('drops a wake for a session that is gone or no longer open', async () => {
    for (const found of [null, sessionAt('idle', true)]) {
      const { handler, dispatch, wakes } = harness(found);
      await handler.execute(new DeliverSessionWakeCommand({ wake: wake() }));
      expect(dispatch.typeKeys).not.toHaveBeenCalled();
      expect(wakes.schedule).not.toHaveBeenCalled();
    }
  });
});
