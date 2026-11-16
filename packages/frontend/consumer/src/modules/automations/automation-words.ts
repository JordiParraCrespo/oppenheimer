import { clock, dayOffset, viewerTimeZone, weekdayDate } from '@oppenheimer/frontend-core';
import { CODING_AGENTS, isCodingAgentId } from '@oppenheimer/shared/agents';
import {
  AUTOMATION_PAUSED_REASONS,
  type AutomationPausedReason,
  type AutomationPlace,
  type AutomationRunStatus,
} from '@oppenheimer/shared/automations';
import { CLOUD_AGENT_LABELS, type CloudAgentId } from '@oppenheimer/shared/schemas/cloud-agent';
import type { TFunction } from 'i18next';
import type { AutomationEntity } from './automation.entity';

/**
 * What an automation's status says, in words, on the web and the phone
 * alike: a run's state, why it is paused, when it runs next, and the agent
 * it runs. Entities in, words out; nothing reads the clock (`now` is handed
 * in by the leaf that ticks).
 */

/** A run's state as a row draws it: live, done, or failed; queued is live, a cancel or expiry failed. */
export type AutomationRunTone = 'running' | 'completed' | 'failed';

/** The three glyphs a run row has: a live dot, a check, an alert. */
export function runState(status: AutomationRunStatus): AutomationRunTone {
  if (status === 'queued' || status === 'running') return 'running';
  if (status === 'failed' || status === 'cancelled' || status === 'expired') return 'failed';
  return 'completed';
}

function isKnownPausedReason(reason: string): reason is AutomationPausedReason {
  return (AUTOMATION_PAUSED_REASONS as readonly string[]).includes(reason);
}

/** Why an automation is paused, in words; the reader paused it when the API says nothing. */
export function pausedReasonText(reason: string | null, t: TFunction): string {
  if (reason === null) return t('automations.pausedReason.user');
  return isKnownPausedReason(reason)
    ? t(`automations.pausedReason.${reason}`)
    : t('automations.pausedReasonOther');
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

/** The agent's name, and Claude Code's cloud named as a place of its own. */
function agentLabel(agent: string, place: AutomationPlace, t: TFunction): string {
  if (place === 'claude-cloud') return t('automations.editor.placeClaudeCloud');
  if (isCodingAgentId(agent)) return CODING_AGENTS[agent].label;
  return CLOUD_AGENT_LABELS[agent as CloudAgentId] ?? agent;
}

/** The model's name, or the agent's default model's when none was picked. */
function modelLabel(agent: string, model: string | null): string | null {
  if (!isCodingAgentId(agent)) return model;
  const models = CODING_AGENTS[agent].models;
  const picked = model ? models.find((candidate) => candidate.id === model) : undefined;
  if (picked) return picked.label;
  if (model) return model;
  return models.find((candidate) => candidate.default)?.label ?? null;
}

/** The agent and its model, "Claude Code · Sonnet", as an automation's subline and its Where it runs name them. */
export function automationAgentText(automation: AutomationEntity, t: TFunction): string {
  const { agent, model, place } = automation.revision;
  return [agentLabel(agent, place, t), modelLabel(agent, model)].filter(Boolean).join(' · ');
}
