import { randomUUID } from 'node:crypto';
import type { TriggerInputDto } from '@oppenheimer/shared';
import {
  externalEventDefinition,
  nextScheduleOccurrence,
  type ScheduleRule,
} from '@oppenheimer/shared/automations';
import type { AutomationTriggerProps } from './automation.types';

/**
 * Triggers from the editor's words to what is stored, and a schedule trigger's
 * next slot. Pure: the catalog and the schedule arithmetic are shared with the
 * console, so the API and the editor's "Next run" agree by construction.
 */

/** The stored trigger for one editor card. `position` is the card's order. */
export function triggerFromInput(input: TriggerInputDto, position: number): AutomationTriggerProps {
  if (input.source === 'schedule') {
    const { source: _source, timezone, ...config } = input;
    return {
      id: randomUUID(),
      position,
      source: 'schedule',
      eventType: 'schedule',
      config,
      timezone,
      nextFireAt: null,
    };
  }
  const definition = externalEventDefinition(input.source, input.event);
  return {
    id: randomUUID(),
    position,
    source: input.source,
    eventType: input.event,
    config: {
      repositories: input.repositories.map(String),
      // An event with nothing to narrow on matches everything, whatever was sent.
      filter: definition?.filterField ? input.filter : { op: 'any' },
    },
    timezone: null,
    nextFireAt: null,
  };
}

/** The rule a schedule trigger fires by, zone included. */
export function scheduleRuleOf(
  trigger: Extract<AutomationTriggerProps, { source: 'schedule' }>,
): ScheduleRule {
  return { ...trigger.config, timezone: trigger.timezone };
}

/** The first slot strictly after `after`, or null when the trigger never fires again. */
export function nextFireOf(trigger: AutomationTriggerProps, after: Date): Date | null {
  if (trigger.source !== 'schedule') return null;
  return nextScheduleOccurrence(scheduleRuleOf(trigger), after);
}

/**
 * A trigger that can never fire: a `once` already past, or a rule with nothing
 * to fire on. Refused at save rather than stored as a trigger that silently
 * does nothing.
 */
export function neverFires(trigger: AutomationTriggerProps, now: Date): boolean {
  return trigger.source === 'schedule' && nextFireOf(trigger, now) === null;
}
