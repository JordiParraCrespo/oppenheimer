import { describe, expect, it, vi } from 'vitest';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { HostUnpairedClosesSessionsDomainEventHandler } from '../event-handlers/host-unpaired-wipe.domain-event-handler';

/**
 * A host removed with its clean-up box ticked: every unresolved session on it is
 * closed, since the runner was told to remove their worktrees. A plain removal's stop
 * is `host-unpaired.domain-event-handler.spec.ts`.
 */
const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const EVENT = { id: 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b', aggregateId: HOST, wipe: true };

function repository(unresolved: WorkSessionEntity[]) {
  const sessions: Pick<
    WorkSessionRepositoryPort,
    'findUnresolvedOnHostForSystem' | 'appendEvents'
  > = {
    findUnresolvedOnHostForSystem: vi.fn().mockResolvedValue(unresolved),
    appendEvents: vi.fn().mockResolvedValue({ accepted: [], rejected: [], appended: [] }),
  };
  return sessions;
}

const session = (id: string) => ({ id }) as WorkSessionEntity;

describe('HostUnpairedClosesSessionsDomainEventHandler', () => {
  it('closes every unresolved session, stopped ones too, one keyed entry each', async () => {
    const sessions = repository([session('s1'), session('s2')]);
    await new HostUnpairedClosesSessionsDomainEventHandler(
      sessions as WorkSessionRepositoryPort,
    ).handle(EVENT);

    expect(sessions.findUnresolvedOnHostForSystem).toHaveBeenCalledWith(HOST);
    expect(sessions.appendEvents).toHaveBeenCalledTimes(2);
    const [target, entries] = vi.mocked(sessions.appendEvents).mock.calls[1];
    expect(target.id).toBe('s2');
    expect(entries).toEqual([
      expect.objectContaining({
        kind: SESSION_EVENT_KINDS.CLOSED,
        source: 'api',
        payload: { requestedBy: 'host.unpaired.wipe' },
      }),
    ]);
    expect(entries[0].idempotencyKey).toContain(EVENT.id);
  });

  it('does nothing for a plain removal', async () => {
    const sessions = repository([session('s1')]);
    await new HostUnpairedClosesSessionsDomainEventHandler(
      sessions as WorkSessionRepositoryPort,
    ).handle({ ...EVENT, wipe: false });

    expect(sessions.findUnresolvedOnHostForSystem).not.toHaveBeenCalled();
    expect(sessions.appendEvents).not.toHaveBeenCalled();
  });
});
