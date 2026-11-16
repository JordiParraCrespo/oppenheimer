import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { clock, dayOffset, viewerTimeZone, weekdayDate } from '@oppenheimer/frontend-core';
import { CODING_AGENTS, isCodingAgentId } from '@oppenheimer/shared/agents';
import {
  AUTOMATION_PAUSED_REASONS,
  type AutomationPausedReason,
} from '@oppenheimer/shared/automations';
import { CLOUD_AGENT_LABELS, type CloudAgentId } from '@oppenheimer/shared/schemas/cloud-agent';

/** A run's state as a row's dot shows it: live, done well, or failed. */
export type RunTone = 'running' | 'completed' | 'failed';

/** The dot for a run's status, in the console's three: queued counts as live, a cancel or expiry as failed. */
export function runTone(status: string): RunTone {
  if (status === 'queued' || status === 'running') return 'running';
  if (status === 'failed' || status === 'cancelled' || status === 'expired') return 'failed';
  return 'completed';
}

/**
 * When the automation runs next, as the console's table says it: "Today,
 * 09:00", "Tomorrow, 02:00", "Mon 5 Oct, 09:00"; "On next event" for one
 * that only listens; none while paused or with nothing ahead. A key and its
 * values, or plain words, for the caller's `t`.
 */
export function nextRunWords(
  automation: AutomationEntity,
  now: number,
  locale: string,
):
  | { key: 'automations.next.onEvent' | 'automations.next.none' }
  | { key: 'automations.next.today' | 'automations.next.tomorrow'; time: string }
  | { text: string } {
  if (automation.isPaused) return { key: 'automations.next.none' };
  const next = automation.nextRunAt;
  if (!next) {
    return automation.triggers.some((trigger) => trigger.source === 'github')
      ? { key: 'automations.next.onEvent' }
      : { key: 'automations.next.none' };
  }
  const zone = viewerTimeZone();
  const time = clock(next, zone);
  const offset = dayOffset(next.getTime(), now, zone);
  if (offset === 0) return { key: 'automations.next.today', time };
  if (offset === 1) return { key: 'automations.next.tomorrow', time };
  return { text: `${weekdayDate(next, locale, zone)}, ${time}` };
}

/** The agent and its model, "Claude Code · Sonnet", as the console's subline names them. */
export function agentWords(automation: AutomationEntity, claudeCloud: string): string {
  const { agent, model, place } = automation.revision;
  if (place === 'claude-cloud') return claudeCloud;
  if (!isCodingAgentId(agent)) {
    const label = CLOUD_AGENT_LABELS[agent as CloudAgentId] ?? agent;
    return model ? `${label} · ${model}` : label;
  }
  const models = CODING_AGENTS[agent].models;
  const picked = (model ? models.find((candidate) => candidate.id === model) : undefined)?.label;
  const named = picked ?? model ?? models.find((candidate) => candidate.default)?.label;
  return [CODING_AGENTS[agent].label, named].filter(Boolean).join(' · ');
}

/**
 * Why an automation is paused, as a key: the reader paused it when the API
 * says nothing, and a reason this build has no words for reads as the
 * generic line rather than its own key path.
 */
export function pausedReasonKey(reason: string | null) {
  if (reason === null) return 'automations.pausedReason.user' as const;
  return (AUTOMATION_PAUSED_REASONS as readonly string[]).includes(reason)
    ? (`automations.pausedReason.${reason as AutomationPausedReason}` as const)
    : ('automations.pausedReasonOther' as const);
}
