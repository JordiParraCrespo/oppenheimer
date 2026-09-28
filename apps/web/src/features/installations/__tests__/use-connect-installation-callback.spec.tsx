import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConnectInstallationCallback } from '@/features/installations/hooks/use-connect-installation-callback';

/**
 * The console never posts a GitHub callback that carries no state it minted:
 * that callback is somebody else's install — a link stopped halfway and
 * forwarded — and posting it would connect their installation here.
 */

const mutate = vi.fn();

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useConnectInstallation: () => ({ mutate, data: undefined, isPending: false, error: null }),
}));

afterEach(() => {
  cleanup();
  mutate.mockReset();
});

const NONCE = 'kX9_mZq-4vR2tY7wB1nC3dE5fG8hJ0kLpQ6sU2xV4yA';

describe('useConnectInstallationCallback', () => {
  it('posts nothing, and says so, for a callback without a state', () => {
    const { result } = renderHook(() => useConnectInstallationCallback(4242, 'abc', undefined));

    expect(mutate).not.toHaveBeenCalled();
    expect(result.current.unstarted).toBe(true);
  });

  it('posts the id, the code and the nonce once when the state is there', () => {
    const { result, rerender } = renderHook(() =>
      useConnectInstallationCallback(4242, 'abc', NONCE),
    );
    rerender();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]?.[0]).toEqual({
      githubInstallationId: 4242,
      code: 'abc',
      state: NONCE,
    });
    expect(result.current.unstarted).toBe(false);
  });

  it('is quiet on a visit that is not a callback at all', () => {
    const { result } = renderHook(() => useConnectInstallationCallback());

    expect(mutate).not.toHaveBeenCalled();
    expect(result.current.unstarted).toBe(false);
  });
});
