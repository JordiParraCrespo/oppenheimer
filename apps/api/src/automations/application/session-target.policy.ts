import { AppError } from '@oppenheimer/backend-core';
import type { AutomationEntity } from '../domain/automation.entity';
import type { SessionTarget } from '../domain/automation.types';
import { AutomationErrors } from '../domain/automations.errors';

/**
 * A session automation's own part (its project, and where and how a run
 * starts a session), for the routes and the run target that only ever hold
 * one. A routine that reaches them is answered as what it is to them: not
 * found, a catalogued refusal rather than a crash.
 */
export function sessionTargetOf(automation: AutomationEntity): SessionTarget {
  const { target } = automation;
  if (target.kind !== 'session') throw new AppError(AutomationErrors.NOT_FOUND);
  return target;
}
