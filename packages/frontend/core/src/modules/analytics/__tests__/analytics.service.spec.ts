import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IAnalyticsClient } from '../analytics.client';
import { ANALYTICS_EVENTS } from '../analytics.events';
import { AnalyticsService } from '../analytics.service';
import { NoopAnalyticsClient } from '../noop-analytics.client';

function createClient(overrides: Partial<IAnalyticsClient> = {}): IAnalyticsClient {
  return {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    pageView: vi.fn(),
    ...overrides,
  };
}

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards calls to the underlying client', () => {
    const client = createClient();
    const service = new AnalyticsService(client);

    service.capture(ANALYTICS_EVENTS.USER_SIGNED_IN, { method: 'password' });
    service.identify('user-1', { email: 'a@b.com' });
    service.pageView('/dashboard');
    service.reset();

    expect(client.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.USER_SIGNED_IN, {
      method: 'password',
    });
    expect(client.identify).toHaveBeenCalledWith('user-1', {
      email: 'a@b.com',
    });
    expect(client.pageView).toHaveBeenCalledWith('/dashboard', undefined);
    expect(client.reset).toHaveBeenCalled();
  });

  // The whole point of the wrapper: a broken analytics provider must never be
  // able to take down a login, a logout, or a render.
  it('swallows provider errors instead of propagating them', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const boom = () => {
      throw new Error('provider exploded');
    };
    const service = new AnalyticsService(
      createClient({
        capture: boom,
        identify: boom,
        reset: boom,
        pageView: boom,
      }),
    );

    expect(() => service.capture(ANALYTICS_EVENTS.USER_SIGNED_IN)).not.toThrow();
    expect(() => service.identify('user-1')).not.toThrow();
    expect(() => service.reset()).not.toThrow();
    expect(() => service.pageView('/')).not.toThrow();
  });
});

describe('NoopAnalyticsClient', () => {
  it('accepts every call and does nothing', () => {
    const client = new NoopAnalyticsClient();

    expect(() => {
      client.capture(ANALYTICS_EVENTS.USER_SIGNED_IN);
      client.identify('user-1');
      client.pageView('/');
      client.reset();
    }).not.toThrow();
  });
});
