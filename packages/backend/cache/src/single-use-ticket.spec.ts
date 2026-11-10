import { describe, expect, it, vi } from 'vitest';
import type { CacheService } from './cache.service';
import { issueSingleUseTicket } from './single-use-ticket';

/**
 * A ticket buys one redemption of something worth guarding (a terminal, a
 * screen): it is claimed atomically under its prefix, never overwritten, and
 * a refused claim mints nothing the caller could hand out.
 */
describe('issueSingleUseTicket', () => {
  it('claims an unguessable, URL-safe key under the prefix, for the TTL', async () => {
    const setIfAbsent = vi.fn().mockResolvedValue(true);
    const cache = { setIfAbsent } as unknown as CacheService;

    const issued = await issueSingleUseTicket(cache, 'desktop:', { hostId: 'h' }, 60);

    expect(issued?.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(setIfAbsent).toHaveBeenCalledWith(`desktop:${issued?.ticket}`, { hostId: 'h' }, 60);
    expect(issued?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 59_000);
  });

  it('answers null when the store refuses the claim', async () => {
    const cache = { setIfAbsent: vi.fn().mockResolvedValue(false) } as unknown as CacheService;

    await expect(issueSingleUseTicket(cache, 'attach:', {}, 60)).resolves.toBeNull();
  });
});
