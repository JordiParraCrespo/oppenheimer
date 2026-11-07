import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useFoldedBots } from '../hooks/use-folded-bots';

/**
 * A section's Bots heading folded in the sidebar comes back folded on the
 * next visit, without folding the heading in another section; opened again,
 * it comes back open.
 */

afterEach(() => window.localStorage.clear());

describe('useFoldedBots', () => {
  it('keeps a fold per section across a reload and forgets it once opened', () => {
    const first = renderHook(() => useFoldedBots('sessions'));
    expect(first.result.current.open).toBe(true);
    act(() => first.result.current.setOpen(false));
    first.unmount();

    expect(renderHook(() => useFoldedBots('sessions')).result.current.open).toBe(false);
    expect(renderHook(() => useFoldedBots('plan')).result.current.open).toBe(true);

    const again = renderHook(() => useFoldedBots('sessions'));
    act(() => again.result.current.setOpen(true));
    again.unmount();
    expect(renderHook(() => useFoldedBots('sessions')).result.current.open).toBe(true);
  });
});
