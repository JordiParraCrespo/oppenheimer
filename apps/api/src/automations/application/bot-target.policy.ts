import { AppError } from '@oppenheimer/backend-core';
import type { AutomationEntity } from '../domain/automation.entity';
import type { BotTarget } from '../domain/automation.types';
import { AutomationErrors } from '../domain/automations.errors';

/**
 * A routine's own part (its bot, its credential's scopes, its prompt), for
 * the reads that only ever hold routines. A session automation that reaches
 * them is answered as what it is to them: not found, as `sessionTargetOf`
 * answers a routine.
 */
export function botTargetOf(automation: AutomationEntity): BotTarget {
  const { target } = automation;
  if (target.kind !== 'bot') throw new AppError(AutomationErrors.NOT_FOUND);
  return target;
}
