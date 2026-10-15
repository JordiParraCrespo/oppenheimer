import { Injectable } from '@nestjs/common';
import type { BotEntity } from '../../bots/domain/bot.entity';
import type { BotApprovalEntity } from '../domain/bot-approval.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { BotTurnBudget } from '../domain/bot-turn-budget.policy';
import { BotOwnerScopeResolver } from './bot-owner-scope.resolver';
import { BotToolboxFactory } from './bot-toolbox.factory';

/** How long an approved call may run inside the decision's request. */
const APPROVED_CALL_TIMEOUT_MS = 60_000;

/**
 * What an approved call answers (`25-bots.md` §5): the stored tool, run with
 * the stored input as the bot's owner, whose scope is resolved now, not when
 * the card was raised; an owner who left the workspace runs nothing. It is
 * offered under the scope filter of the turn that asked. The context lets
 * exactly this call through: anything else it might reach still
 * asks, and asking from here is refused rather than raising another card.
 */
@Injectable()
export class BotApprovedCallResolver {
  constructor(
    private readonly owners: BotOwnerScopeResolver,
    private readonly toolbox: BotToolboxFactory,
  ) {}

  /**
   * `asked` is the turn that raised the card: its time zone, and the scopes
   * of the credential it was sent with, which bound the tools it could reach
   * then and still bound what may run now. No turn means nothing runs.
   */
  async resolve(
    bot: BotEntity,
    approval: BotApprovalEntity,
    asked: BotTurnEntity | null,
  ): Promise<{ content: string; isError: boolean }> {
    const owner = await this.owners.resolve(bot.organizationId, bot.createdByUserId);
    if (!owner) {
      return {
        content: "Not run: the bot's owner can no longer act in this workspace.",
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
        timeZone: asked?.timeZone ?? 'UTC',
        permission: bot.permission,
        budget: new BotTurnBudget(),
        approvals: {
          request: async () => {
            throw new Error('An approved call asked again');
          },
        },
      },
      asked ? asked.credentialScopes : [],
      { tool: approval.tool, input: approval.input },
      AbortSignal.timeout(APPROVED_CALL_TIMEOUT_MS),
    );
  }
}
