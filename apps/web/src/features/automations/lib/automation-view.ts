import {
  type AutomationEntity,
  type AutomationRunEntity,
  automationAgentText,
  type BotRoutineEntity,
  nextInstantText,
} from '@oppenheimer/frontend-consumer';
import { formatCountdown, formatShortDuration } from '@oppenheimer/frontend-web';
import {
  AUTOMATION_SKIP_REASONS,
  type AutomationSkipReason,
} from '@oppenheimer/shared/automations';
import type { TFunction } from 'i18next';

/**
 * Entities in, what a row prints out. Nothing here renders and nothing here
 * reads the clock: `now` is handed in by the leaf that ticks.
 */

/**
 * Reasons arrive from the API, which may learn a new one before this build
 * does. A key built from a value this build has no copy for would render as
 * its own path, so an unknown one reads as the generic line instead.
 */
function isKnownSkipReason(reason: string): reason is AutomationSkipReason {
  return (AUTOMATION_SKIP_REASONS as readonly string[]).includes(reason);
}

function skipReasonText(reason: string, t: TFunction): string {
  return isKnownSkipReason(reason)
    ? t(`automations.skipReason.${reason}`)
    : t('automations.skipReasonOther');
}

export function runTitle(run: AutomationRunEntity, t: TFunction): string {
  return run.skipReason ? `${run.title} · ${skipReasonText(run.skipReason, t)}` : run.title;
}

/** The status dot's state for an automation: the design system's routine vocabulary. */
export function automationDot(automation: AutomationEntity): 'running' | 'active' | 'paused' {
  return automation.status;
}

/** A bot routine's next run, as `nextRunText` says an automation's. */
export function routineNextText(
  routine: BotRoutineEntity,
  now: number,
  locale: string,
  t: TFunction,
): string {
  if (routine.isPaused) return t('automations.next.none');
  if (routine.nextRunAt) return nextInstantText(routine.nextRunAt, now, locale, t);
  return routine.triggers.some((trigger) => trigger.source === 'github')
    ? t('automations.next.onEvent')
    : t('automations.next.none');
}

/** The mono countdown under a next run, or nothing when there is none. */
export function nextRunCountdown(
  automation: AutomationEntity,
  now: number,
  locale: string,
): string | null {
  if (automation.isPaused || !automation.nextRunAt) return null;
  return formatCountdown(automation.nextRunAt.getTime() - now, locale);
}

/**
 * The sidebar row's mono meta: Running, Paused, the wait until the next slot
 * ("in 45h"), else how many runs it has made.
 */
export function sidebarMeta(automation: AutomationEntity, now: number, t: TFunction): string {
  if (automation.isRunning) return t('automations.sidebar.running');
  if (automation.isPaused) return t('automations.sidebar.paused');
  if (automation.nextRunAt) {
    const wait = automation.nextRunAt.getTime() - now;
    return t('automations.next.in', {
      time: formatShortDuration(wait, t, 'wait'),
    });
  }
  return automation.runCount ? String(automation.runCount) : '';
}

/** Agent · model · project: the line under an automation's name. */
export function automationSubline(
  automation: AutomationEntity,
  project: string | undefined,
  t: TFunction,
) {
  return [automationAgentText(automation, t), project].filter(Boolean).join(' · ');
}

/** The bot routines table's column heads, for the table and its placeholder. */
export function botRoutineColumns(t: TFunction): [string, string, string, string] {
  return [
    t('automations.routines.routine'),
    t('automations.table.trigger'),
    t('automations.table.next'),
    t('automations.table.status'),
  ];
}
