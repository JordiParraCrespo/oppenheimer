import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSessionFilters } from '../hooks/use-session-filters';
import { SESSION_FILTERS_KEY, withinOptions } from '../lib/session-filter-memory';
import { ALL, DEFAULT_FILTERS, type FilterOption, type SessionFacet } from '../lib/session-filters';

/**
 * The sidebar's filters come back on the next visit on this device, as the
 * reader left them; what storage holds that cannot be read, or that names
 * something gone, never hides the list.
 */

afterEach(() => window.localStorage.clear());

describe('useSessionFilters', () => {
  it('keeps the filters and sort across a reload', () => {
    const first = renderHook(() => useSessionFilters());
    act(() => first.result.current[1]({ ...DEFAULT_FILTERS, project: ['p1'], sort: 'name' }));
    first.unmount();

    const second = renderHook(() => useSessionFilters());
    expect(second.result.current[0]).toEqual({ ...DEFAULT_FILTERS, project: ['p1'], sort: 'name' });
  });

  it('reads an unreadable field as its default and keeps the rest', () => {
    window.localStorage.setItem(
      SESSION_FILTERS_KEY,
      JSON.stringify({ project: 'p1', repository: ['acme/app'], sort: 'loudest' }),
    );
    const { result } = renderHook(() => useSessionFilters());
    expect(result.current[0]).toEqual({ ...DEFAULT_FILTERS, repository: ['acme/app'] });
  });

  it('starts unfiltered from something that is not JSON', () => {
    window.localStorage.setItem(SESSION_FILTERS_KEY, '{');
    const { result } = renderHook(() => useSessionFilters());
    expect(result.current[0]).toEqual(DEFAULT_FILTERS);
  });
});

describe('withinOptions', () => {
  const offered = (...values: string[]): FilterOption[] => [
    { value: ALL, label: 'All' },
    ...values.map((value) => ({ value, label: value })),
  ];
  const options: Record<SessionFacet, FilterOption[]> = {
    project: offered('p1'),
    repository: offered('acme/app'),
    agent: offered('claude'),
    host: offered('h1'),
  };

  it('drops a remembered pick the menu no longer offers, so it reads as all', () => {
    expect(
      withinOptions(
        {
          project: ['deleted'],
          repository: ['acme/app', 'acme/gone'],
          agent: ['claude'],
          host: ['h-gone'],
          sort: 'oldest',
        },
        options,
      ),
    ).toEqual({
      project: [],
      repository: ['acme/app'],
      agent: ['claude'],
      host: [],
      sort: 'oldest',
    });
  });
});
