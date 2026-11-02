import type { AccessScope } from '@oppenheimer/backend-authz';
import type { TriggerInputDto } from '@oppenheimer/shared';
import { AutomationPlanFactory } from '../application/automation-plan.factory';

/**
 * A Sentry trigger names the workspace's own connection. What breaks this: a
 * trigger saved on another workspace's connection id, which would fire on
 * that workspace's errors, or a save refused when nothing names Sentry.
 */
const OWN = '6f1c2d3e-0000-4000-8000-000000000001';
const scope = { organizationId: 'org-1', userId: 'user-1' } as AccessScope;
const sentry = (connectionId: string): TriggerInputDto => ({
  source: 'sentry',
  event: 'issue_created',
  connectionId,
  filter: { op: 'any' },
});

function plan(connected: boolean) {
  const queryBus = {
    execute: vi.fn(async () => ({ configured: true, connection: connected ? { id: OWN } : null })),
  };
  return {
    factory: new AutomationPlanFactory({} as never, {} as never, {} as never, queryBus as never),
    queryBus,
  };
}

describe('AutomationPlanFactory.assertSentryConnection', () => {
  it('accepts the workspace’s own connection', async () => {
    await expect(plan(true).factory.assertSentryConnection(scope, [sentry(OWN)])).resolves.toBe(
      undefined,
    );
  });

  it('refuses a connection id the workspace does not hold', async () => {
    const other = '6f1c2d3e-0000-4000-8000-000000000002';
    await expect(
      plan(true).factory.assertSentryConnection(scope, [sentry(other)]),
    ).rejects.toMatchObject({ code: 'SENTRY_002' });
    await expect(
      plan(false).factory.assertSentryConnection(scope, [sentry(OWN)]),
    ).rejects.toMatchObject({ code: 'SENTRY_002' });
  });

  it('asks nothing when no trigger is Sentry’s', async () => {
    const { factory, queryBus } = plan(false);
    await factory.assertSentryConnection(scope, [
      { source: 'github', event: 'push', repositories: [1], filter: { op: 'any' } },
    ]);
    expect(queryBus.execute).not.toHaveBeenCalled();
  });
});
