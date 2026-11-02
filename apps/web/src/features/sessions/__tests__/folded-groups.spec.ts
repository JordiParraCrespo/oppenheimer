import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useFoldedGroups } from '../hooks/use-folded-groups';
import { FOLDED_GROUPS_KEY, withFold } from '../lib/folded-groups';
import { storedList } from '../lib/stored-list';

/**
 * A project group folded in the sidebar comes back folded on the next visit,
 * and one opened again comes back open.
 */

afterEach(() => window.localStorage.clear());

describe('useFoldedGroups', () => {
  it('keeps a fold across a reload and forgets it once opened', () => {
    const first = renderHook(() => useFoldedGroups());
    act(() => first.result.current.setOpen('p1', false));
    act(() => first.result.current.setOpen('unfiled', false));
    first.unmount();

    const second = renderHook(() => useFoldedGroups());
    expect(second.result.current.folded).toEqual(['p1', 'unfiled']);
    act(() => second.result.current.setOpen('p1', true));
    expect(storedList(FOLDED_GROUPS_KEY)).toEqual(['unfiled']);
  });
});

describe('withFold', () => {
  it('folds a group once however often it is folded', () => {
    expect(withFold(withFold(['a'], 'a', false), 'a', false)).toEqual(['a']);
  });
});
