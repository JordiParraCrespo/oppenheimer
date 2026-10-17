import { z } from 'zod';
import { timeZoneSchema } from './automation.schema.js';
import { calendarDateSchema } from './task.schema.js';

/**
 * `GET /plan/stats`: Plan's Stats, per week of a period and compared with the
 * period just before it (`product/versions/mvp/23-plan-milestones-stats-accounts.md`
 * §4). Weeks start on Monday in the viewer's `timeZone`, so a task completed
 * late on Sunday in Tokyo counts in Tokyo's week.
 */

/** The longest period one read covers: a year and a week. */
export const PLAN_STATS_MAX_DAYS = 371;

const DAY_MS = 86_400_000;

/** The days from `from` to `to`, both included. */
export function planStatsDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

export const planStatsQuerySchema = z
  .object({
    from: calendarDateSchema,
    /** Included. */
    to: calendarDateSchema,
    timeZone: timeZoneSchema,
    projectId: z.string().uuid().optional(),
    /** Also answer the period of the same length just before `from`. */
    compare: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
  })
  .refine((query) => query.from <= query.to, { path: ['to'] })
  .refine((query) => planStatsDays(query.from, query.to) <= PLAN_STATS_MAX_DAYS, {
    path: ['from'],
  });

export type PlanStatsQueryDto = z.infer<typeof planStatsQuerySchema>;
export type PlanStatsQueryInput = z.input<typeof planStatsQuerySchema>;

/** The period of the same length that ends the day before `from`. */
export function previousPlanStatsPeriod(from: string, to: string): { from: string; to: string } {
  const days = planStatsDays(from, to);
  const start = Date.parse(`${from}T00:00:00Z`);
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { from: iso(start - days * DAY_MS), to: iso(start - DAY_MS) };
}

/** The Mondays of the weeks that touch `from`..`to`, oldest first. */
export function planStatsWeeks(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = Date.parse(`${to}T00:00:00Z`);
  const weeks: string[] = [];
  for (let day = start.getTime(); day <= end; day += 7 * DAY_MS) {
    weeks.push(new Date(day).toISOString().slice(0, 10));
  }
  return weeks;
}
