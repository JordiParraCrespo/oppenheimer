import { describe, expect, it } from 'vitest';
import { planClosedReads } from '../domain/closed-read.policy';

/** #247: what one Analytics read takes in full, and when it may say it saw everything. */
const SINCE = new Date('2026-09-01T00:00:00Z');
const pull = (n: number, day: number) => ({
  n,
  closedAt: `2026-09-${String(day).padStart(2, '0')}T00:00:00Z`,
});
const at = (p: { closedAt: string }) => p.closedAt;

describe('the closed read plan', () => {
  it('keeps the newest across every repository, so one busy repository cannot spend the ceiling', () => {
    const plan = planClosedReads(
      [
        { pulls: [pull(1, 20), pull(2, 19), pull(3, 18)], full: false },
        { pulls: [pull(9, 21)], full: false },
      ],
      at,
      SINCE,
      2,
    );
    expect(plan.picks).toEqual([[pull(1, 20)], [pull(9, 21)]]);
    expect(plan.complete).toBe(false);
  });

  it('is complete when everything in the window fits and no page may hide more', () => {
    const plan = planClosedReads(
      [{ pulls: [pull(1, 20), pull(2, 2)], full: false }],
      at,
      SINCE,
      150,
    );
    expect(plan.picks).toEqual([[pull(1, 20), pull(2, 2)]]);
    expect(plan.complete).toBe(true);
  });

  it('is not complete when a full page still ends inside the window', () => {
    expect(
      planClosedReads([{ pulls: [pull(1, 20), pull(2, 3)], full: true }], at, SINCE, 150).complete,
    ).toBe(false);
  });

  it('is complete when a full page already reaches past the window', () => {
    const before = { n: 3, closedAt: '2026-08-01T00:00:00Z' };
    const plan = planClosedReads([{ pulls: [pull(1, 20), before], full: true }], at, SINCE, 150);
    expect(plan.picks).toEqual([[pull(1, 20)]]);
    expect(plan.complete).toBe(true);
  });
});
