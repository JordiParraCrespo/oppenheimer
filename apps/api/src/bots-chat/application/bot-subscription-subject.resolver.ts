import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { BotEntity } from '../../bots/domain/bot.entity';
import { SessionErrors } from '../../sessions/domain/sessions.errors';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import { FindSessionQuery } from '../../sessions/queries/find-session/find-session.query';
import type { BotSubscriptionEntity } from '../domain/bot-subscription.entity';
import { BotModelAccessResolver } from './bot-model-access.resolver';
import { BotOwnerScopeResolver } from './bot-owner-scope.resolver';

/** What a wake acts on: the bot, the owner it acts as, and the session as that owner reads it now. */
export interface WakeSubjectRead {
  bot: BotEntity;
  ownerUserId: string;
  session: WorkSessionEntity;
}

/**
 * Everything a subscription's wake reads before deciding
 * (`27-bot-subscriptions.md` §4, §5), as one answer: the subject, or null
 * when the bot is gone, it has no owner, the owner left the workspace, or
 * the owner can no longer read the session. Null is the one way a wake
 * learns that access was lost.
 */
@Injectable()
export class BotSubscriptionSubjectResolver {
  constructor(
    private readonly access: BotModelAccessResolver,
    private readonly owners: BotOwnerScopeResolver,
    private readonly queries: QueryBus,
  ) {}

  async resolve(subscription: BotSubscriptionEntity): Promise<WakeSubjectRead | null> {
    const bot = await this.access.findBot(subscription.organizationId, subscription.botId);
    const ownerUserId = bot?.createdByUserId;
    if (!bot || !ownerUserId) return null;
    const owner = await this.owners.resolve(subscription.organizationId, ownerUserId);
    if (!owner) return null;
    const session = await this.readable(owner, subscription.resourceId);
    return session ? { bot, ownerUserId, session } : null;
  }

  /**
   * The session as `owner` reads it. The sessions module answers a session
   * someone may not read the way it answers one that does not exist,
   * `SESSIONS_001`, so that refusal is the null; anything else is a fault and
   * throws, for the outbox to retry.
   */
  private readable(owner: AccessScope, sessionId: string): Promise<WorkSessionEntity | null> {
    return this.queries
      .execute<FindSessionQuery, WorkSessionEntity>(
        new FindSessionQuery({ scope: owner, sessionId }),
      )
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === SessionErrors.NOT_FOUND.code) return null;
        throw error;
      });
  }
}
