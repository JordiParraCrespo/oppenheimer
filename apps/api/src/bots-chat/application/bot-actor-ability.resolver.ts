import { Inject, Injectable } from '@nestjs/common';
import { canAccessRow } from '@oppenheimer/backend-authz';
import type { AbilityPort } from '../../auth/application/ability.port';
import { ABILITY } from '../../auth/auth.di-tokens';
import type { BotToolPolicy } from './bot-tool.factory';

/**
 * Whether a person may do what a tool's call does, by the role rule the
 * route it stands in for checks (`BotToolSpec.policy`): the bot's owner when
 * the call runs, the decider when they approve its card. The ability is the
 * one `PoliciesGuard` would build for them in the bot's workspace, read now,
 * from their roles there alone: no platform role, so, as for the owner's
 * scope (`BotOwnerScopeResolver`), a card is never more than the person.
 */
@Injectable()
export class BotActorAbilityResolver {
  constructor(@Inject(ABILITY) private readonly abilities: AbilityPort) {}

  /** `row` is the record the call acts on, for a rule conditioned on it (its workspace, at least). */
  async may(
    organizationId: string,
    userId: string,
    policy: BotToolPolicy,
    row: Record<string, unknown> = { organizationId },
  ): Promise<boolean> {
    const ability = await this.abilities.forRequest({
      user: { id: userId },
      tenant: { organizationId },
    });
    return canAccessRow(ability, policy.action, policy.subject, row);
  }
}
