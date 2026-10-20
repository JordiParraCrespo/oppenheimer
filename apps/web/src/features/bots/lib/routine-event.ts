import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';

type RoutineEvent = Extract<NonNullable<BotMessageEntity['event']>, { kind: 'routine' }>;

const ROUTINE_REASONS = [
  'expired',
  'automation_rate_limited',
  'workspace_rate_limited',
  'missed',
  'agent_unavailable',
  'bot_provider_missing',
  'owner_lost_access',
] as const;

/** Why, in words: a code the API sent that this build does not know reads as "something went wrong". */
function reasonText(reason: string | null, t: TFunction): string {
  const known = ROUTINE_REASONS.find((candidate) => candidate === reason);
  return t(`bots.chat.routineReason.${known ?? 'unknown'}`);
}

/**
 * Whether a routine's line is a notice rather than a divider: a run that did
 * not happen, or a pause the owner did not make, both of which need them.
 */
export function routineNeedsOwner(event: RoutineEvent): boolean {
  if (event.activity === 'failed') return true;
  return event.activity === 'paused' && event.reason !== null && event.reason !== 'user';
}

/** A routine's line in the chat and in an export: "Created routine “Morning PR digest”". */
export function routineEventText(event: RoutineEvent, t: TFunction): string {
  const { name } = event;
  switch (event.activity) {
    case 'ran':
      return t('bots.chat.event.routine', { name });
    case 'saved':
      return t('bots.chat.event.routineSaved', { name });
    case 'changed':
      return t('bots.chat.event.routineChanged', { name });
    case 'paused':
      return routineNeedsOwner(event)
        ? t('bots.chat.event.routinePausedBecause', { name, reason: reasonText(event.reason, t) })
        : t('bots.chat.event.routinePaused', { name });
    case 'resumed':
      return t('bots.chat.event.routineResumed', { name });
    case 'deleted':
      return t('bots.chat.event.routineDeleted', { name });
    case 'failed':
      return t('bots.chat.event.routineFailed', { name, reason: reasonText(event.reason, t) });
  }
}
