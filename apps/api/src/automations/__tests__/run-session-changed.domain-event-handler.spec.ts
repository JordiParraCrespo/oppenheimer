import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import { RunSessionChangedDomainEventHandler } from '../application/event-handlers/run-session-changed.domain-event-handler';
import type { AutomationRunRepositoryPort } from '../database/automation-run.repository.port';
import type { AutomationRunEntity } from '../domain/automation-run.entity';

/**
 * A dispatched run is running and then finished only through its session, so
 * without this the console's run screens learn neither until they poll.
 */
function setup(run: Partial<AutomationRunEntity> | null) {
  const runs = {
    findOneBySessionForSystem: vi.fn().mockResolvedValue(run ? Some(run) : None),
  } as unknown as AutomationRunRepositoryPort;
  const events = { publish: vi.fn() };
  return { runs, events, handler: new RunSessionChangedDomainEventHandler(runs, events) };
}

const run = { id: 'run-1', organizationId: 'org-1', automationId: 'auto-1' };

describe('RunSessionChangedDomainEventHandler', () => {
  it("announces the run whose session's automation turn moved", async () => {
    const { events, handler } = setup(run);
    await handler.onTurn({ aggregateId: 's-1', origin: 'automation' });
    expect(events.publish).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      { type: 'automationRun.changed', id: 'run-1', automationId: 'auto-1' },
    );
  });

  it("does not look up a person's turn, which is never a run's", async () => {
    const { runs, events, handler } = setup(run);
    await handler.onTurn({ aggregateId: 's-1', origin: 'person' });
    expect(runs.findOneBySessionForSystem).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('announces on a lifecycle change, and stays quiet for a session no run started', async () => {
    const started = setup(run);
    await started.handler.onState({ aggregateId: 's-1' });
    expect(started.events.publish).toHaveBeenCalledTimes(1);

    const plain = setup(null);
    await plain.handler.onState({ aggregateId: 's-2' });
    expect(plain.events.publish).not.toHaveBeenCalled();
  });
});
