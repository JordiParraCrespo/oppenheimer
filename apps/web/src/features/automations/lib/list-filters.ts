import type { AutomationTrigger } from '@oppenheimer/frontend-consumer';
import { z } from 'zod';

/**
 * The status pills of the Automations and Bot routines tabs. A running item
 * is active unless it is paused: running is what it is doing now, paused is
 * whether its triggers fire.
 */
export const STATUS_TABS = ['all', 'active', 'paused'] as const;
export type StatusTab = (typeof STATUS_TABS)[number];

/** What an automation or a routine can be started by, in the order the trigger facet lists them. */
const TRIGGER_SOURCES = ['schedule', 'gmail', 'github', 'webhook'] as const;
export type TriggerSource = (typeof TRIGGER_SOURCES)[number];

/**
 * The search fields every filtered list shares, for its route's schema to
 * spread beside its owner facet. A value a field does not accept reads as
 * absent, which is the default, never as an error that fails the route.
 */
export const listSearchFields = {
  status: z.enum(STATUS_TABS).optional().catch(undefined),
  trigger: z.enum(TRIGGER_SOURCES).optional().catch(undefined),
};

/** What a list's filter row reads and writes: its state in the URL, and a setter per facet. */
export interface ListFilters {
  state: ListFilterState;
  dirty: boolean;
  setStatus: (status: StatusTab) => void;
  setOwner: (owner: string | null) => void;
  setTrigger: (trigger: TriggerSource | null) => void;
  clear: () => void;
}

/** A list's filters: the status pill, the one facet the list is grouped by (a bot, a project), the trigger. */
export interface ListFilterState {
  status: StatusTab;
  owner: string | null;
  trigger: TriggerSource | null;
}

interface Filterable {
  isPaused: boolean;
  triggers: readonly Pick<AutomationTrigger, 'source'>[];
}

function matchesStatus(item: Filterable, status: StatusTab): boolean {
  if (status === 'all') return true;
  return status === 'paused' ? item.isPaused : !item.isPaused;
}

/**
 * The items the filters keep, and each pill's count. The counts are taken
 * after the owner and trigger facets and before the status, so a pill says
 * what picking it would show.
 */
export function filterList<T extends Filterable>(
  items: readonly T[],
  state: ListFilterState,
  ownerOf: (item: T) => string,
) {
  const faceted = items.filter(
    (item) =>
      (state.owner === null || ownerOf(item) === state.owner) &&
      (state.trigger === null || item.triggers.some((t) => t.source === state.trigger)),
  );
  const counts = Object.fromEntries(
    STATUS_TABS.map((tab) => [tab, faceted.filter((item) => matchesStatus(item, tab)).length]),
  ) as Record<StatusTab, number>;
  return { rows: faceted.filter((item) => matchesStatus(item, state.status)), counts };
}

/** The trigger sources some item uses: the facet offers only those, so a pick never lands on nothing. */
export function usedTriggerSources(items: readonly Filterable[]): TriggerSource[] {
  return TRIGGER_SOURCES.filter((source) =>
    items.some((item) => item.triggers.some((trigger) => trigger.source === source)),
  );
}
