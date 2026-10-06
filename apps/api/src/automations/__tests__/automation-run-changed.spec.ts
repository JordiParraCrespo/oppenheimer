import { describe, expect, it } from 'vitest';
import { AutomationRunEntity } from '../domain/automation-run.entity';
import { AutomationRunChangedDomainEvent } from '../domain/events/automation-run-changed.domain-event';

const props = {
  organizationId: 'org-1',
  automationId: 'auto-1',
  revisionId: 'rev-1',
  triggerId: null,
  cause: 'manual',
  causeKey: 'manual:1',
  causeSummary: { label: 'Run now', detail: 'Started from the automation page' },
  inboundEventId: null,
  scheduledFor: null,
  requestedByUserId: 'u-1',
} as unknown as Parameters<typeof AutomationRunEntity.fire>[0];

const changes = (run: AutomationRunEntity) =>
  run.domainEvents.filter((event) => event instanceof AutomationRunChangedDomainEvent);

/**
 * The console's run screens hear a run move through this one event, so each
 * outcome a run is written in raises it, once per write.
 */
describe('AutomationRunEntity raises a change per write', () => {
  it('when it fires, and once when a guard skips it on the way in', () => {
    const now = new Date();
    expect(changes(AutomationRunEntity.fire(props, now))).toHaveLength(1);
    const skipped = AutomationRunEntity.skipped(props, 'paused' as never, now);
    expect(changes(skipped)).toHaveLength(1);
    expect(changes(skipped)[0]).toMatchObject({
      aggregateId: skipped.id,
      organizationId: 'org-1',
      automationId: 'auto-1',
    });
  });

  it('when it is deferred, expired or dispatched', () => {
    const now = new Date();
    for (const move of [
      (run: AutomationRunEntity) => run.defer(now),
      (run: AutomationRunEntity) => run.expire(),
      (run: AutomationRunEntity) => run.dispatched('s-1', 'rev-1', now),
    ]) {
      const run = AutomationRunEntity.fire(props, now);
      run.clearEvents();
      move(run);
      expect(changes(run)).toHaveLength(1);
    }
  });
});
