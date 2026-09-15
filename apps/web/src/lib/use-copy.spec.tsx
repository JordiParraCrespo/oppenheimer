import { toast } from '@oppenheimer/design-system-web';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopy } from './use-copy';

/**
 * Three screens had each grown their own version of this, and a fourth had no
 * feedback at all. The two things the hand-rolled versions got wrong are the
 * ones asserted hardest here: none of them cleared the timer on unmount (copy,
 * then close the lead drawer, and React warns about state on an unmounted
 * component), and none of them handled a rejected clipboard write.
 */

vi.mock('@oppenheimer/design-system-web', () => ({
  toast: { success: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  vi.mocked(toast.success).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useCopy', () => {
  it('starts un-copied', () => {
    expect(renderHook(() => useCopy()).result.current.copied).toBe(false);
  });

  it('writes the value to the clipboard', async () => {
    const { result } = renderHook(() => useCopy());

    await act(() => result.current.copy('sk_live_123'));

    expect(writeText).toHaveBeenCalledWith('sk_live_123');
  });

  it('flips to copied and toasts', async () => {
    // The flag drives the icon flip where the button is the affordance; the
    // toast covers the menu items that have already closed.
    const { result } = renderHook(() => useCopy());

    await act(() => result.current.copy('x'));

    expect(result.current.copied).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('toasts.copied');
  });

  it('flips back after the confirmation window', async () => {
    const { result } = renderHook(() => useCopy());

    await act(() => result.current.copy('x'));
    act(() => vi.advanceTimersByTime(1200));

    expect(result.current.copied).toBe(false);
  });

  it('restarts the window on a second copy rather than flipping back early', async () => {
    const { result } = renderHook(() => useCopy());

    await act(() => result.current.copy('a'));
    act(() => vi.advanceTimersByTime(1000));
    await act(() => result.current.copy('b'));

    // 1000ms after the *second* copy — the first timer would have fired by now.
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.copied).toBe(true);

    act(() => vi.advanceTimersByTime(200));
    expect(result.current.copied).toBe(false);
  });

  describe('when the clipboard is unavailable', () => {
    it('stays quiet instead of raising', async () => {
      // Permission can be refused, and over plain HTTP the API is not there at
      // all. The value is on screen either way, so an error the reader cannot
      // act on is worse than silence.
      writeText.mockRejectedValue(new Error('NotAllowedError'));
      const { result } = renderHook(() => useCopy());

      await expect(act(() => result.current.copy('x'))).resolves.toBeUndefined();
    });

    it('does not claim success', async () => {
      writeText.mockRejectedValue(new Error('NotAllowedError'));
      const { result } = renderHook(() => useCopy());

      await act(() => result.current.copy('x'));

      expect(result.current.copied).toBe(false);
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  it('clears its timer on unmount', async () => {
    // The bug every hand-rolled copy button had: copy, then close the drawer,
    // and the pending `setCopied(false)` lands on an unmounted component.
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useCopy());

    await act(() => result.current.copy('x'));
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    // Nothing should be left to fire.
    expect(() => act(() => vi.advanceTimersByTime(2000))).not.toThrow();
  });
});
