import type { PlanEventKind } from '@oppenheimer/shared';

/**
 * Who changed something on Plan: a person, or an agent acting for one
 * (`product/versions/mvp/23-plan-milestones-stats-accounts.md` §7). An agent can
 * do no more than its person may; the person is always named.
 */
export type PlanActor =
  | { type: 'user'; userId: string }
  | { type: 'agent'; userId: string; agentId: string };

export function userActor(userId: string): PlanActor {
  return { type: 'user', userId };
}

/**
 * One change worth logging, as an aggregate records it. The repository writes
 * it to `plan_event` in the same transaction as the change.
 */
export interface PlanChange {
  kind: PlanEventKind;
  /** The subject's project and milestone when it happened. */
  projectId: string;
  milestoneId: string | null;
  actor: PlanActor;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

/** What a write did to the row, for the console's change feed. */
export type PlanWriteKind = 'created' | 'updated' | 'deleted';
