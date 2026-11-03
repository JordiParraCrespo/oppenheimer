/**
 * A stored GitHub event on a pull request reaches the bots that follow it
 * (`27-bot-subscriptions.md` §7): one wake per subscription to that
 * repository and number in the event's workspace, carrying the stored event's
 * id and its metadata; our own app's events, events with no pull request and
 * events that wake nobody are dropped before any read. What each wake does is
 * `wake-on-pull-request.command-handler.spec.ts`.
 */
import type { CommandBus } from '@nestjs/cqrs';
import { WakeOnPullRequestCommand } from '../../commands/wake-on-pull-request/wake-on-pull-request.command';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';
import { BotPullRequestWakeDomainEventHandler } from '../event-handlers/bot-pull-request-wake.domain-event-handler';

function harness(ids: string[], execute = vi.fn(async (_command: unknown) => undefined)) {
  const subscriptions = {
    findIdsForPullRequest: vi.fn<BotSubscriptionRepositoryPort['findIdsForPullRequest']>(
      async () => ids,
    ),
  };
  const handler = new BotPullRequestWakeDomainEventHandler(
    subscriptions as unknown as BotSubscriptionRepositoryPort,
    { execute } as unknown as CommandBus,
  );
  return { handler, subscriptions, execute };
}

const event = (overrides: Record<string, unknown> = {}) =>
  ({
    aggregateId: 'evt-1',
    organizationId: 'org-acme',
    source: 'github',
    eventType: 'check_failed',
    subjectRef: '821374923',
    actorLogin: 'github-actions[bot]',
    actorIsOwnApp: false,
    attributes: { number: 128, conclusion: 'failure', check: 'CI' },
    metadata: { correlationId: 'corr-1', timestamp: Date.now() },
    ...overrides,
  }) as Parameters<BotPullRequestWakeDomainEventHandler['handle']>[0];

describe('BotPullRequestWakeDomainEventHandler', () => {
  it('wakes each bot following the pull request once, keyed by the stored event', async () => {
    const { handler, subscriptions, execute } = harness(['sub-1', 'sub-2']);
    await handler.handle(event());
    expect(subscriptions.findIdsForPullRequest).toHaveBeenCalledWith('org-acme', '821374923', 128);
    const sent = execute.mock.calls.map(([command]) => command as WakeOnPullRequestCommand);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toBeInstanceOf(WakeOnPullRequestCommand);
    expect(sent.map((command) => command.subscriptionId)).toEqual(['sub-1', 'sub-2']);
    expect(sent[0]).toMatchObject({
      inboundEventId: 'evt-1',
      type: 'check_failed',
      attributes: { number: 128, conclusion: 'failure', check: 'CI' },
      actorLogin: 'github-actions[bot]',
      metadata: { correlationId: 'corr-1' },
    });
  });

  // Regression: our own app's comment or merge would wake the bot that made it, in a loop.
  it.each([
    ['our own app acted', { actorIsOwnApp: true }],
    ['the source is not GitHub', { source: 'gmail' }],
    ['the event wakes nobody', { eventType: 'pr_sync' }],
    ['it names no pull request', { attributes: { conclusion: 'failure' } }],
    [
      'it names an issue',
      { eventType: 'comment', attributes: { number: 7, isPullRequest: false } },
    ],
    ['the repository is not an id', { subjectRef: 'acme/app' }],
  ])('reads nothing and wakes nobody when %s', async (_why, overrides) => {
    const { handler, subscriptions, execute } = harness(['sub-1']);
    await handler.handle(event(overrides));
    expect(subscriptions.findIdsForPullRequest).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  // Regression: a listener whose failure is swallowed lets the outbox mark the
  // event delivered, and the wake is lost.
  it('wakes the others when one fails, then throws for the outbox to deliver again', async () => {
    const execute = vi.fn(async (command: unknown) => {
      if ((command as WakeOnPullRequestCommand).subscriptionId === 'sub-1') {
        throw new Error('database down');
      }
    });
    const { handler } = harness(['sub-1', 'sub-2'], execute);
    await expect(handler.handle(event())).rejects.toThrow('database down');
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
