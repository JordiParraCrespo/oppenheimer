import type { RunState } from '@oppenheimer/design-system-web';
import type { AutomationEntity, AutomationRunEntity } from '@oppenheimer/frontend-consumer';
import { CODING_AGENTS, isCodingAgentId } from '@oppenheimer/shared/agents';
import type { AutomationRunStatus } from '@oppenheimer/shared/automations';
import type { TFunction } from 'i18next';
import { clock, countdown, dayOffset, shortWait, viewerTimeZone, weekdayDate } from './time';

/**
 * Entities in, what a row prints out. Nothing here renders and nothing here
 * reads the clock: `now` is handed in by the leaf that ticks.
 */

/** The three glyphs a run row has: a live dot, a check, an alert. */
export function runState(status: AutomationRunStatus): RunState {
  if (status === 'queued' || status === 'running') return 'running';
  if (status === 'failed' || status === 'cancelled' || status === 'expired') return 'failed';
  return 'completed';
}

/** A run's title with why it never started, when it did not. */
export function runTitle(run: AutomationRunEntity, t: TFunction): string {
  return run.skipReason
    ? `${run.title} · ${t(`automations.skipReason.${run.skipReason}`)}`
    : run.title;
}

/** The status dot's state for an automation: the design system's routine vocabulary. */
export function automationDot(automation: AutomationEntity): 'running' | 'active' | 'paused' {
  return automation.status;
}

/**
 * The table's next-run column: "Today, 09:00", "Tomorrow, 02:00",
 * "Mon 5 Oct, 09:00"; "On next event" for an automation that only listens;
 * a dash while paused or with nothing ahead.
 */
export function nextRunText(
  automation: AutomationEntity,
  now: number,
  locale: string,
  t: TFunction,
): string {
  if (automation.isPaused) return t('automations.next.none');
  const next = automation.nextRunAt;
  if (!next) {
    return automation.triggers.some((trigger) => trigger.source === 'github')
      ? t('automations.next.onEvent')
      : t('automations.next.none');
  }
  return nextInstantText(next, now, locale, t);
}

export function nextInstantText(next: Date, now: number, locale: string, t: TFunction): string {
  const zone = viewerTimeZone();
  const time = clock(next, zone);
  const offset = dayOffset(next.getTime(), now, zone);
  if (offset === 0) return t('automations.next.today', { time });
  if (offset === 1) return t('automations.next.tomorrow', { time });
  return `${weekdayDate(next, locale, zone)}, ${time}`;
}

/** The mono countdown under a next run, or nothing when there is none. */
export function nextRunCountdown(automation: AutomationEntity, now: number): string | null {
  if (automation.isPaused || !automation.nextRunAt) return null;
  return countdown(automation.nextRunAt.getTime() - now);
}

/**
 * The sidebar row's mono meta: Running, Paused, the wait until the next slot
 * ("in 45h"), else how many runs it has made.
 */
export function sidebarMeta(automation: AutomationEntity, now: number, t: TFunction): string {
  if (automation.isRunning) return t('automations.sidebar.running');
  if (automation.isPaused) return t('automations.sidebar.paused');
  if (automation.nextRunAt) {
    return t('automations.next.in', { time: shortWait(automation.nextRunAt.getTime() - now) });
  }
  return automation.runCount ? String(automation.runCount) : '';
}

/** The agent's name as the catalog has it. */
export function agentLabel(agent: string): string {
  return isCodingAgentId(agent) ? CODING_AGENTS[agent].label : agent;
}

/** The model's name, or the agent's default model's when none was picked. */
export function modelLabel(agent: string, model: string | null): string | null {
  if (!isCodingAgentId(agent)) return model;
  const models = CODING_AGENTS[agent].models;
  const picked = model ? models.find((candidate) => candidate.id === model) : undefined;
  if (picked) return picked.label;
  if (model) return model;
  return models.find((candidate) => candidate.default)?.label ?? null;
}

/** Agent · model · project: the line under an automation's name. */
export function automationSubline(automation: AutomationEntity, project: string | undefined) {
  const { agent, model } = automation.revision;
  return [agentLabel(agent), modelLabel(agent, model), project].filter(Boolean).join(' · ');
}
