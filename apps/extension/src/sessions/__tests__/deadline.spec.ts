import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSessionEvents } from '../chat';

// The worker's deadline, short enough for a test to wait it out.
vi.mock('../deadline', () => ({
  REQUEST_TIMEOUT_MS: 50,
  deadline: () => AbortSignal.timeout(50),
}));

afterEach(() => vi.unstubAllGlobals());

describe('a claude.ai read that never answers', () => {
  it('is given up on, so the worker’s one queue moves on', async () => {
    // Regression: a read with no deadline held the worker's serial queue, and
    // replies and chats stopped for good after one post.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_, reject) =>
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
          ),
      ),
    );
    const read = await fetchSessionEvents('session_014a8EH8DJs95X1iK8ZH9Y82', {}, null);
    expect(read).toBeNull();
  });
});
