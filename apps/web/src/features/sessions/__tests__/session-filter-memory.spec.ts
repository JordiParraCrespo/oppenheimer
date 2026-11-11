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

describe('useSessionFilters', () => {
  it('keeps the filters and sort across a reload', () => {
    const first = renderHook(() => useSessionFilters(options));
    act(() =>
      first.result.current[1](() => ({ ...DEFAULT_FILTERS, project: ['p1'], sort: 'name' })),
    );
    first.unmount();

    const second = renderHook(() => useSessionFilters(options));
    expect(second.result.current[0]).toEqual({ ...DEFAULT_FILTERS, project: ['p1'], sort: 'name' });
  });

  it('reads an unreadable field as its default and keeps the rest', () => {
    window.localStorage.setItem(
      SESSION_FILTERS_KEY,
      JSON.stringify({ project: 'p1', repository: ['acme/app'], sort: 'loudest' }),
    );
    const { result } = renderHook(() => useSessionFilters(options));
    expect(result.current[0]).toEqual({ ...DEFAULT_FILTERS, repository: ['acme/app'] });
  });

  it('forgets a pick that is gone, so its repository coming back does not bring it back', () => {
    window.localStorage.setItem(
      SESSION_FILTERS_KEY,
      JSON.stringify({ ...DEFAULT_FILTERS, repository: ['acme/gone'] }),
    );
    const { result, rerender } = renderHook(({ offer }) => useSessionFilters(offer), {
      initialProps: { offer: options },
    });
    expect(result.current[0].repository).toEqual([]);
    act(() => result.current[1]((current) => ({ ...current, project: ['p1'] })));

    rerender({ offer: { ...options, repository: offered('acme/app', 'acme/gone') } });
    expect(result.current[0]).toEqual({ ...DEFAULT_FILTERS, project: ['p1'] });
    expect(JSON.parse(window.localStorage.getItem(SESSION_FILTERS_KEY) ?? '')).toEqual({
      ...DEFAULT_FILTERS,
      project: ['p1'],
    });
  });

  it('does not bring a gone pick back in the same visit when nothing else changed', () => {
    window.localStorage.setItem(
      SESSION_FILTERS_KEY,
      JSON.stringify({ ...DEFAULT_FILTERS, host: ['h-gone'] }),
    );
    const { result, rerender } = renderHook(({ offer }) => useSessionFilters(offer), {
      initialProps: { offer: options },
    });
    rerender({ offer: { ...options, host: offered('h1', 'h-gone') } });
    expect(result.current[0]).toEqual(DEFAULT_FILTERS);
  });

  it('starts unfiltered from something that is not JSON', () => {
    window.localStorage.setItem(SESSION_FILTERS_KEY, '{');
    const { result } = renderHook(() => useSessionFilters(options));
    expect(result.current[0]).toEqual(DEFAULT_FILTERS);
  });
});

describe('withinOptions', () => {
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
