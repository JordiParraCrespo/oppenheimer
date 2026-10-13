import { describe, expect, it } from 'vitest';
import {
  planStatsQuerySchema,
  planStatsWeeks,
  previousPlanStatsPeriod,
} from '../plan-stats.schema.js';

describe('Plan stats period', () => {
  it('lists the Mondays of every week the period touches', () => {
    // 2026-10-13 is a Tuesday; 2026-11-01 a Sunday.
    expect(planStatsWeeks('2026-10-13', '2026-11-01')).toEqual([
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
  });

  it('compares with the period of the same length that ends the day before', () => {
    expect(previousPlanStatsPeriod('2026-10-01', '2026-10-28')).toEqual({
      from: '2026-09-03',
      to: '2026-09-30',
    });
  });

  it('takes a real zone, an ordered range of at most a year and a week, and compares by default', () => {
    const base = { from: '2026-01-01', to: '2026-01-31', timeZone: 'Europe/Madrid' };
    expect(planStatsQuerySchema.parse(base).compare).toBe(true);
    expect(planStatsQuerySchema.parse({ ...base, compare: 'false' }).compare).toBe(false);
    expect(planStatsQuerySchema.safeParse({ ...base, timeZone: 'Mars/Olympus' }).success).toBe(
      false,
    );
    expect(planStatsQuerySchema.safeParse({ ...base, to: '2025-12-31' }).success).toBe(false);
    expect(planStatsQuerySchema.safeParse({ ...base, to: '2027-01-08' }).success).toBe(false);
  });
});
