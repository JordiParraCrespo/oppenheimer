import { describe, expect, it, vi } from 'vitest';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { HostUnpairedStopsSessionsDomainEventHandler } from '../event-handlers/host-unpaired.domain-event-handler';

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const EVENT = { id: 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b', aggregateId: HOST };

function repository(running: WorkSessionEntity[]) {
  const sessions: Pick<WorkSessionRepositoryPort, 'findRunningOnHostForSystem' | 'appendEvents'> = {
    findRunningOnHostForSystem: vi.fn().mockResolvedValue(running),
    appendEvents: vi.fn().mockResolvedValue({ accepted: [], rejected: [], appended: [] }),
  };
  return sessions;
}

const session = (id: string) => ({ id }) as WorkSessionEntity;

describe('HostUnpairedStopsSessionsDomainEventHandler', () => {
  it('stops every session running on the removed host, one stop entry each', async () => {
    const sessions = repository([session('s1'), session('s2')]);
    await new HostUnpairedStopsSessionsDomainEventHandler(
      sessions as WorkSessionRepositoryPort,
    ).handle(EVENT);

    expect(sessions.findRunningOnHostForSystem).toHaveBeenCalledWith(HOST);
    expect(sessions.appendEvents).toHaveBeenCalledTimes(2);
    const [target, entries] = vi.mocked(sessions.appendEvents).mock.calls[0];
    expect(target.id).toBe('s1');
    // Stopped, never closed: a close pushes branches and removes worktrees,
    // which only the host could do, and the host is gone.
    expect(entries).toEqual([
      expect.objectContaining({
        kind: SESSION_EVENT_KINDS.STOPPED,
        source: 'api',
        payload: { requestedBy: 'host.unpaired' },
      }),
    ]);
  });

  it('keys each entry by the domain event, so a redelivery appends nothing new', async () => {
    const first = repository([session('s1')]);
    const second = repository([session('s1')]);
    await new HostUnpairedStopsSessionsDomainEventHandler(
      first as WorkSessionRepositoryPort,
    ).handle(EVENT);
    await new HostUnpairedStopsSessionsDomainEventHandler(
      second as WorkSessionRepositoryPort,
    ).handle(EVENT);

    const key = (sessions: typeof first) =>
      vi.mocked(sessions.appendEvents).mock.calls[0][1][0].idempotencyKey;
    expect(key(first)).toBe(key(second));
    expect(key(first)).toContain(EVENT.id);
  });

  it('does nothing for a host with nothing running', async () => {
    const sessions = repository([]);
    await new HostUnpairedStopsSessionsDomainEventHandler(
      sessions as WorkSessionRepositoryPort,
    ).handle(EVENT);

    expect(sessions.appendEvents).not.toHaveBeenCalled();
  });
});
