import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { TaskActivityLoggedDomainEvent } from '../../../tasks/domain/events/task-activity-logged.domain-event';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../../bots-chat.di-tokens';
import { WakeOnTaskActivityCommand } from '../../commands/wake-on-task-activity/wake-on-task-activity.command';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';

/**
 * Where a change Plan logged on a task reaches the bots that follow its
 * project or its milestone (`27-bot-subscriptions.md` §7.2): each subscription
 * to either, woken once per change. A task moved to another project or
 * milestone also reaches those that followed where it was, so they learn it
 * left.
 */
@Injectable()
export class BotTaskWakeDomainEventHandler {
  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    private readonly commands: CommandBus,
  ) {}

  // `suppressErrors: false`, as for a pull request's wake: a wake that
  // failed is thrown, for the outbox to deliver the event again.
  @OnEvent(TaskActivityLoggedDomainEvent.name, { suppressErrors: false })
  async handle(
    event: Pick<
      TaskActivityLoggedDomainEvent,
      | 'id'
      | 'aggregateId'
      | 'organizationId'
      | 'kind'
      | 'projectId'
      | 'milestoneId'
      | 'previous'
      | 'title'
      | 'from'
      | 'to'
      | 'actor'
      | 'metadata'
    >,
  ): Promise<void> {
    const places = [{ projectId: event.projectId, milestoneId: event.milestoneId }];
    if (event.previous) places.push(event.previous);
    const ids = await this.subscriptions.findIdsForPlan(event.organizationId, {
      projectIds: unique(places.map((place) => place.projectId)),
      milestoneIds: unique(places.flatMap((place) => place.milestoneId ?? [])),
    });
    const settled = await Promise.allSettled(
      ids.map((subscriptionId) =>
        this.commands.execute(
          new WakeOnTaskActivityCommand({
            subscriptionId,
            change: {
              eventId: event.id,
              taskId: event.aggregateId,
              kind: event.kind,
              projectId: event.projectId,
              milestoneId: event.milestoneId,
              title: event.title,
              from: event.from,
              to: event.to,
              actor: event.actor,
            },
            metadata: { correlationId: event.metadata?.correlationId ?? undefined },
          }),
        ),
      ),
    );
    const failed = settled.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
