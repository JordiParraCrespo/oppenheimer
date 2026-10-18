import { Injectable } from '@nestjs/common';
import type { Scope } from '@oppenheimer/shared';
import type { BotEntity } from '../../bots/domain/bot.entity';
import type { BotApprovalEntity } from '../domain/bot-approval.entity';
import { BotTurnBudget } from '../domain/bot-turn-budget.policy';
import { BotActorAbilityResolver } from './bot-actor-ability.resolver';
import { BotOwnerScopeResolver } from './bot-owner-scope.resolver';
import { BotToolboxFactory } from './bot-toolbox.factory';

/** How long an approved call may run inside its job. */
const APPROVED_CALL_TIMEOUT_MS = 60_000;

/**
 * What an approved call answers (`25-bots.md` §5): the stored tool, run with
 * the stored input as the bot's owner, whose scope is resolved now, not when
 * the card was raised; an owner who left the workspace runs nothing.
 * `granted` is what both the asking turn's and the deciding credential's
 * scopes cover (null: a browser session on both sides). A tool with a role
 * rule (`policy`) runs only while the owner holds it, as its route would
 * check. The context it runs with has no requester, so the call cannot raise
 * another card.
 */
@Injectable()
export class BotApprovedCallResolver {
  constructor(
    private readonly owners: BotOwnerScopeResolver,
    private readonly toolbox: BotToolboxFactory,
    private readonly abilities: BotActorAbilityResolver,
  ) {}

  async resolve(
    bot: BotEntity,
    approval: BotApprovalEntity,
    granted: readonly Scope[] | null,
    timeZone: string | null,
  ): Promise<{ content: string; isError: boolean }> {
    const owner = await this.owners.resolve(bot.organizationId, bot.createdByUserId);
    if (!owner) {
      return {
        content: "Not run: the bot's owner can no longer act in this workspace.",
        isError: true,
      };
    }
    const policy = this.toolbox.policyOf(approval.tool);
    if (policy && !(await this.abilities.may(bot.organizationId, owner.userId, policy))) {
      return {
        content: `Not run: the bot's owner may not ${policy.action} ${policy.subject} in this workspace.`,
        isError: true,
      };
    }
    return this.toolbox.runApproved(
      {
        owner,
        organizationId: bot.organizationId,
        botId: bot.id,
        turnId: approval.turnId,
        homeHostId: bot.homeHostId,
        timeZone: timeZone ?? 'UTC',
        permission: bot.permission,
        budget: new BotTurnBudget(),
        approvalId: approval.id,
      },
      granted,
      { tool: approval.tool, input: approval.input },
      AbortSignal.timeout(APPROVED_CALL_TIMEOUT_MS),
    );
  }
}
