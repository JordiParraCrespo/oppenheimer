import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNewSessionBackground } from '../hooks/use-new-session-background';

// jsdom cannot decode images; the decode is the lib's, and what this guards
// is what the hook does with its answer.
vi.mock('../lib/new-session-background', async (original) => ({
  ...(await original<typeof import('../lib/new-session-background')>()),
  backgroundFromFile: vi.fn(async () => 'data:image/jpeg;base64,AAAA'),
}));

const file = new File(['x'], 'sunset.png', { type: 'image/png' });

/**
 * A background the browser refuses to keep (a full quota, private browsing)
 * says so on screen. Without it the image shows, then vanishes on the next
 * reload with nothing to explain why.
 */
describe('useNewSessionBackground', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('keeps a chosen image across a reload', async () => {
    const { result } = renderHook(() => useNewSessionBackground());
    await act(() => result.current.choose(file));

    expect(result.current.failure).toBeNull();
    expect(renderHook(() => useNewSessionBackground()).result.current.image).toBe(
      'data:image/jpeg;base64,AAAA',
    );
  });

  it('says the image is unsaved when storage refuses it, and still shows it', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useNewSessionBackground());
    await act(() => result.current.choose(file));

    expect(result.current.image).toBe('data:image/jpeg;base64,AAAA');
    expect(result.current.failure).toBe('unsaved');
  });
});
