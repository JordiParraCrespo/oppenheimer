import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { BotPlanWatchScope } from '@oppenheimer/shared';
import type { ProjectEntity } from '../../projects/domain/project.entity';
import { ProjectErrors } from '../../projects/domain/projects.errors';
import { FindProjectQuery } from '../../projects/queries/find-project/find-project.query';
import type { MilestoneWithProgress } from '../../tasks/database/milestone.repository.port';
import { TaskErrors } from '../../tasks/domain/tasks.errors';
import { FindMilestoneQuery } from '../../tasks/queries/find-milestone/find-milestone.query';
import { type PlanWatch, toPlanWatchProps } from '../bot-plan-tool.mapper';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../database/bot-subscription.repository.port';
import { BotSubscriptionEntity } from '../domain/bot-subscription.entity';
import { BOT_SUBSCRIPTIONS_PER_BOT } from '../domain/bot-subscription.policy';
import { type BotToolCallContext, BotToolRefusal } from './bot-tool.factory';

/** What a project or milestone watch came to: the subscription as stored, and the name read. */
export interface PlanWatchResult {
  subscription: BotSubscriptionEntity;
  name: string;
}

/**
 * A bot starts or stops following the tasks of a project or of one
 * milestone (`27-bot-subscriptions.md` §7.2), and a wake reads what it follows
 * again. Both read it as the bot's owner, so a bot follows only what its
 * owner can read, and a wake whose owner no longer can ends the
 * subscription.
 */
@Injectable()
export class BotPlanWatchResolver {
  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    private readonly queries: QueryBus,
  ) {}

  async watch(
    context: BotToolCallContext,
    watch: PlanWatch,
    purpose: string | null,
  ): Promise<PlanWatchResult> {
    const name = await this.nameOf(context.owner, watch.scope, watch.id);
    if (name === null) {
      throw new BotToolRefusal(
        `There is no ${watch.scope} ${watch.id} you can read: list_projects lists the projects, list_tasks names each task's milestone.`,
      );
    }
    await this.assertRoom(context, watch);
    const subscription = await this.subscriptions.subscribe(
      BotSubscriptionEntity.subscribeToPlan(toPlanWatchProps(context, watch, purpose)),
    );
    return { subscription, name };
  }

  unwatch(context: BotToolCallContext, scope: BotPlanWatchScope, id: string): Promise<boolean> {
    return this.subscriptions.unsubscribePlan(context.organizationId, context.botId, scope, id);
  }

  /**
   * The project's or the milestone's name as `owner` reads it, or null when
   * it is gone or `owner` may not read it: each module answers both with its
   * not-found code. Anything else is a fault and throws, for the outbox to
   * retry a wake.
   */
  async nameOf(owner: AccessScope, scope: BotPlanWatchScope, id: string): Promise<string | null> {
    const read =
      scope === 'project'
        ? this.queries
            .execute<FindProjectQuery, ProjectEntity>(
              new FindProjectQuery({ scope: owner, projectId: id }),
            )
            .then((project) => project.name)
        : this.queries
            .execute<FindMilestoneQuery, MilestoneWithProgress>(
              new FindMilestoneQuery({ scope: owner, milestoneId: id }),
            )
            .then(({ milestone }) => milestone.name);
    const notFound = scope === 'project' ? ProjectErrors.NOT_FOUND : TaskErrors.MILESTONE_NOT_FOUND;
    return read.catch((error: unknown) => {
      if (error instanceof AppError && error.code === notFound.code) return null;
      throw error;
    });
  }

  /** The limit is one for everything a bot follows; watching one again is not a new one. */
  private async assertRoom(context: BotToolCallContext, watch: PlanWatch): Promise<void> {
    const existing = await this.subscriptions.findForBot(
      context.organizationId,
      context.botId,
      BOT_SUBSCRIPTIONS_PER_BOT,
    );
    const already = existing.some(
      (subscription) =>
        subscription.resourceKind === watch.scope && subscription.resourceId === watch.id,
    );
    if (!already && existing.length >= BOT_SUBSCRIPTIONS_PER_BOT) {
      throw new BotToolRefusal(
        `You already follow ${BOT_SUBSCRIPTIONS_PER_BOT} sessions, pull requests, projects and milestones. Unwatch one you no longer need (list_watches shows them) first.`,
      );
    }
  }
}
