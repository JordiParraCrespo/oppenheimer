import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useStoredList } from './use-stored-list';

/**
 * Every reader of one key sees the same list: Settings → Agents switching an
 * agent off takes it out of a New session picker already open, in this tab or
 * another. What breaks this: each hook keeping its own copy read at mount, so
 * the picker goes on offering what Settings just hid.
 */

const KEY = 'test.stored-list';

afterEach(() => window.localStorage.clear());

describe('useStoredList', () => {
  it('shows a change made through one reader in another already mounted', () => {
    const settings = renderHook(() => useStoredList(KEY));
    const picker = renderHook(() => useStoredList(KEY));

    act(() => settings.result.current[1](['grok:off']));

    expect(picker.result.current[0]).toEqual(['grok:off']);
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? 'null')).toEqual(['grok:off']);
  });

  it('follows a change another tab writes', () => {
    const picker = renderHook(() => useStoredList(KEY));

    act(() => {
      window.localStorage.setItem(KEY, JSON.stringify(['pi:on']));
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });

    expect(picker.result.current[0]).toEqual(['pi:on']);
  });

  it('applies an updater to the latest list', () => {
    const { result } = renderHook(() => useStoredList(KEY));

    act(() => result.current[1]((current) => [...current, 'a']));
    act(() => result.current[1]((current) => [...current, 'b']));

    expect(result.current[0]).toEqual(['a', 'b']);
  });
});
