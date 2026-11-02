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

/** An editor card's source, and what a stored trigger of that source holds besides its id and place. */
type TriggerSource = TriggerInputDto['source'];
type StoredFields<S extends TriggerSource> = Omit<
  Extract<AutomationTriggerProps, { source: S }>,
  'id' | 'position'
>;

/**
 * How each source's editor card becomes what is stored: one pure function per
 * source, so a new source is a row here rather than a branch in
 * `triggerFromInput`. A source the record does not list fails to compile.
 */
const STORED: {
  [S in TriggerSource]: (input: Extract<TriggerInputDto, { source: S }>) => StoredFields<S>;
} = {
  schedule: ({ source: _source, timezone, ...config }) => ({
    source: 'schedule',
    eventType: 'schedule',
    config,
    timezone,
    nextFireAt: null,
  }),
  github: (input) => ({
    source: 'github',
    eventType: input.event,
    config: {
      repositories: input.repositories.map(String),
      // An event with nothing to narrow on matches everything, whatever was sent.
      filter: externalEventDefinition('github', input.event)?.filterField
        ? input.filter
        : { op: 'any' },
    },
    timezone: null,
    nextFireAt: null,
  }),
  gmail: (input) => ({
    source: 'gmail',
    eventType: input.event,
    config: {
      connectionId: input.connectionId,
      filter: input.query ? { op: 'equals', value: input.query } : { op: 'any' },
    },
    timezone: null,
    nextFireAt: null,
  }),
  sentry: (input) => ({
    source: 'sentry',
    eventType: input.event,
    config: { connectionId: input.connectionId, filter: input.filter },
    timezone: null,
    nextFireAt: null,
  }),
};

/** The stored trigger for one editor card. `position` is the card's order. */
export function triggerFromInput(input: TriggerInputDto, position: number): AutomationTriggerProps {
  // TypeScript cannot pair a union's member with its own row of the record.
  const stored = STORED[input.source] as (card: TriggerInputDto) => StoredFields<TriggerSource>;
  return { id: randomUUID(), position, ...stored(input) } as AutomationTriggerProps;
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
