import { afterEach, describe, expect, it } from 'vitest';
import {
  PLAN_FILTERS_KEY,
  rememberPlanFilters,
  restorePlanFilters,
} from '../lib/plan-filter-memory';

/**
 * Plan's filters come back the way a view was left, as a Notion view's do: a
 * visit with no filter in the address takes the remembered one, a visit with
 * one keeps it and remembers it, and a Clear stays cleared. Each view keeps
 * its own, and nothing unreadable in storage narrows a view.
 */

afterEach(() => window.localStorage.clear());

describe('restorePlanFilters', () => {
  it('leaves a first visit unfiltered', () => {
    expect(restorePlanFilters('board', {})).toBeUndefined();
  });

  it('gives a visit without a filter the one the view was left with', () => {
    rememberPlanFilters('board', { project: 'web,billing', milestone: 'm1' });
    expect(restorePlanFilters('board', {})).toEqual({ project: 'web,billing', milestone: 'm1' });
  });

  it('keeps a filter the address names and remembers it over the old one', () => {
    rememberPlanFilters('board', { project: 'web' });
    expect(restorePlanFilters('board', { project: 'billing' })).toBeUndefined();
    expect(restorePlanFilters('board', {})).toEqual({ project: 'billing' });
  });

  it('stays cleared once the filter is cleared', () => {
    rememberPlanFilters('board', { project: 'web' });
    rememberPlanFilters('board', {});
    expect(restorePlanFilters('board', {})).toBeUndefined();
  });

  it('keeps each view its own, and a milestone only on the board', () => {
    rememberPlanFilters('milestones', { project: 'web', milestone: 'm1' });
    expect(restorePlanFilters('board', {})).toBeUndefined();
    expect(restorePlanFilters('milestones', {})).toEqual({ project: 'web' });
  });

  it.each(['{not json', '"web"', '{"board":{"project":3}}'])(
    'narrows nothing when storage holds %s',
    (raw) => {
      window.localStorage.setItem(PLAN_FILTERS_KEY, raw);
      expect(restorePlanFilters('board', {})).toBeUndefined();
    },
  );
});
