import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { AutomationRunRepositoryPort } from '../../../automations/database/automation-run.repository.port';
import type { AutomationRunEntity } from '../../../automations/domain/automation-run.entity';
import { AutomationRunChangesDomainEventHandler } from '../event-handlers/automation-run-changes.domain-event-handler';
import { HostChangesDomainEventHandler } from '../event-handlers/host-changes.domain-event-handler';
import { SessionChangesDomainEventHandler } from '../event-handlers/session-changes.domain-event-handler';

function bus() {
  return { publish: vi.fn(async () => undefined), subscribe: vi.fn() };
}

describe('SessionChangesDomainEventHandler', () => {
  it("announces the session to its workspace's console", async () => {
    const events = bus();
    await new SessionChangesDomainEventHandler(events).handle({
      aggregateId: 's-1',
      organizationId: 'org-1',
    });
    expect(events.publish).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      { type: 'session.changed', id: 's-1' },
    );
  });

  /** The outbox delivers again only when the handler fails. */
  it('fails when the publish does, so the outbox delivers the event again', async () => {
    const events = bus();
    events.publish.mockRejectedValueOnce(new Error('down'));
    await expect(
      new SessionChangesDomainEventHandler(events).handle({
        aggregateId: 's-1',
        organizationId: 'org-1',
      }),
    ).rejects.toThrow('down');
  });
});

/**
 * A dispatched run is running and then finished only through its session, so
 * without the session half its screens would learn neither until they poll.
 */
describe('AutomationRunChangesDomainEventHandler', () => {
  const run = { id: 'run-1', organizationId: 'org-1', automationId: 'auto-1' };
  function setup(found: Partial<AutomationRunEntity> | null) {
    const runs = {
      findOneBySessionForSystem: vi.fn().mockResolvedValue(found ? Some(found) : None),
    } as unknown as AutomationRunRepositoryPort;
    const events = bus();
    return { runs, events, handler: new AutomationRunChangesDomainEventHandler(events, runs) };
  }

  it("announces a run's own change", async () => {
    const { events, handler } = setup(null);
    await handler.onRun({ aggregateId: 'run-1', organizationId: 'org-1', automationId: 'auto-1' });
    expect(events.publish).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      { type: 'automationRun.changed', id: 'run-1', automationId: 'auto-1' },
    );
  });

  it('announces the run a changed automation session belongs to', async () => {
    const { events, handler } = setup(run);
    await handler.onSession({ aggregateId: 's-1', origin: 'automation' });
    expect(events.publish).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      { type: 'automationRun.changed', id: 'run-1', automationId: 'auto-1' },
    );
  });

  it("never looks up a person's session, which is no run's", async () => {
    const { runs, events, handler } = setup(run);
    await handler.onSession({ aggregateId: 's-1', origin: 'person' });
    expect(runs.findOneBySessionForSystem).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });
});

/** A host has no workspace: announced to one, its change would reach nobody. */
describe('HostChangesDomainEventHandler', () => {
  it('tells the owner a token was spent, on which machine, and that their list changed', async () => {
    const events = bus();
    await new HostChangesDomainEventHandler(events).onRegistered({
      aggregateId: 'host-1',
      ownerUserId: 'jordi',
      pairingTokenId: 'token-1',
    });
    expect(events.publish.mock.calls).toEqual([
      [{ userId: 'jordi' }, { type: 'pairing.spent', id: 'token-1', hostId: 'host-1' }],
      [{ userId: 'jordi' }, { type: 'host.changed', id: 'host-1' }],
    ]);
  });

  it('tells the owner a host was renamed or unpaired', async () => {
    const events = bus();
    const handler = new HostChangesDomainEventHandler(events);
    await handler.onRenamed({ aggregateId: 'host-1', ownerUserId: 'jordi' });
    await handler.onUnpaired({ aggregateId: 'host-2', ownerUserId: 'jordi' });
    expect(events.publish.mock.calls).toEqual([
      [{ userId: 'jordi' }, { type: 'host.changed', id: 'host-1' }],
      [{ userId: 'jordi' }, { type: 'host.changed', id: 'host-2' }],
    ]);
  });
});
