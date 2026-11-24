import type { BotRoutineEntity } from '@oppenheimer/frontend-consumer';
import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/** The Bot routines tab's status pills. A running routine is active unless paused. */
export const ROUTINE_STATUS_TABS = ['all', 'active', 'paused'] as const;
export type RoutineStatusTab = (typeof ROUTINE_STATUS_TABS)[number];

/** What a routine can be started by, in the order the trigger facet lists them. */
export const ROUTINE_TRIGGER_SOURCES = ['schedule', 'gmail', 'github', 'webhook'] as const;
export type RoutineTriggerSource = (typeof ROUTINE_TRIGGER_SOURCES)[number];

/**
 * The Bot routines tab's facets, in the URL, like the Runs tab's: a filtered
 * list is a link someone can send, and a value the schema does not accept
 * reads as absent, which is the default.
 */
export const routinesSearchSchema = z.object({
  status: z.enum(ROUTINE_STATUS_TABS).optional().catch(undefined),
  bot: searchText,
  trigger: z.enum(ROUTINE_TRIGGER_SOURCES).optional().catch(undefined),
});
export type RoutinesSearch = z.infer<typeof routinesSearchSchema>;

export interface RoutinesFilterState {
  status: RoutineStatusTab;
  bot: string | null;
  trigger: RoutineTriggerSource | null;
}

type Routine = Pick<BotRoutineEntity, 'botId' | 'isPaused' | 'triggers'>;

function matchesStatus(routine: Routine, status: RoutineStatusTab): boolean {
  if (status === 'all') return true;
  return status === 'paused' ? routine.isPaused : !routine.isPaused;
}

function matchesFacets(routine: Routine, state: RoutinesFilterState): boolean {
  if (state.bot !== null && routine.botId !== state.bot) return false;
  if (state.trigger !== null && !routine.triggers.some((t) => t.source === state.trigger)) {
    return false;
  }
  return true;
}

/**
 * The routines the filters keep, and each pill's count. The counts are taken
 * after the bot and trigger facets and before the status, so a pill says
 * what picking it would show.
 */
export function filterRoutines<T extends Routine>(
  routines: readonly T[],
  state: RoutinesFilterState,
) {
  const faceted = routines.filter((routine) => matchesFacets(routine, state));
  const counts = Object.fromEntries(
    ROUTINE_STATUS_TABS.map((tab) => [
      tab,
      faceted.filter((routine) => matchesStatus(routine, tab)).length,
    ]),
  ) as Record<RoutineStatusTab, number>;
  return { rows: faceted.filter((routine) => matchesStatus(routine, state.status)), counts };
}
