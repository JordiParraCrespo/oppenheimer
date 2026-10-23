import type { BotRoutineActivity } from '@oppenheimer/shared';
import type { AutomationEntity } from './automation.entity';
import type { AutomationChange } from './automation.types';
import { BotRoutineChangedDomainEvent } from './events/bot-routine-changed.domain-event';

const ACTIVITY: Readonly<Record<AutomationChange, BotRoutineChangedDomainEvent['activity']>> = {
  created: 'saved',
  edited: 'changed',
  paused: 'paused',
  resumed: 'resumed',
  deleted: 'deleted',
} satisfies Record<AutomationChange, BotRoutineActivity>;

/**
 * What a save of one of a bot's routines tells its chat (`26-bot-routines.md`
 * §4, "In the chat"): one event per kind of change the save made, so a save
 * that renames and re-prompts says "changed" once. The aggregate only records
 * what changed; a session automation's changes tell no chat anything.
 */
export function routineActivityEvents(
  automation: AutomationEntity,
): BotRoutineChangedDomainEvent[] {
  const { target } = automation;
  if (target.kind !== 'bot') return [];
  return [...automation.changes].map(
    (change) =>
      new BotRoutineChangedDomainEvent({
        aggregateId: automation.id,
        reason: `the routine was ${ACTIVITY[change]}`,
        organizationId: automation.organizationId,
        botId: target.botId,
        name: automation.name,
        activity: ACTIVITY[change],
        pausedReason: change === 'paused' ? automation.pausedReason : null,
      }),
  );
}
