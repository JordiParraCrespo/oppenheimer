import { type PlanTaskEventKind, TASK_STATUSES, type TaskStatus } from '@oppenheimer/shared';
import type { PlanChange } from './plan-change.types';

/** A change as a follower reads it: which columns it moved between, and where it was filed before. */
export interface TaskActivity {
  kind: PlanTaskEventKind;
  from: TaskStatus | null;
  to: TaskStatus | null;
  previous: { projectId: string; milestoneId: string | null } | null;
}

/**
 * What a logged change tells a follower of the task (`27-bot-subscriptions.md`
 * §7.2), from the change and the column the task is in once the write lands.
 * A move names both columns; a completion the one it left; a reopening the
 * one it went to; a delete the one it was in. Any other change names the
 * column it stays in. Pure.
 */
export function taskActivityOf(change: PlanChange, status: TaskStatus): TaskActivity {
  const kind = change.kind as PlanTaskEventKind;
  const { payload } = change;
  const base = { kind, previous: null };
  switch (kind) {
    case 'status_changed':
      return { ...base, from: statusOf(payload.from), to: statusOf(payload.to) ?? status };
    case 'completed':
      return { ...base, from: statusOf(payload.from), to: 'done' };
    case 'reopened':
      return { ...base, from: 'done', to: statusOf(payload.to) ?? status };
    case 'deleted':
      return { ...base, from: status, to: null };
    case 'reassigned':
      return { kind, from: null, to: status, previous: placeOf(payload.from) };
    default:
      return { ...base, from: null, to: status };
  }
}

function statusOf(value: unknown): TaskStatus | null {
  return TASK_STATUSES.find((status) => status === value) ?? null;
}

function placeOf(value: unknown): TaskActivity['previous'] {
  if (typeof value !== 'object' || value === null) return null;
  const { projectId, milestoneId } = value as Record<string, unknown>;
  if (typeof projectId !== 'string') return null;
  return { projectId, milestoneId: typeof milestoneId === 'string' ? milestoneId : null };
}
