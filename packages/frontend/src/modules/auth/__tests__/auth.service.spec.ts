import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_EVENTS } from '../../analytics/analytics.events';
import type { AnalyticsService } from '../../analytics/analytics.service';
import type { IStorageService } from '../../core/storage.service';
import type { AuthSession } from '../auth.client';
import type { AuthRepository } from '../auth.repository';
import { AuthService } from '../auth.service';
import { createAuthStore } from '../auth.state';

const SESSION: AuthSession = {
  user: {
    id: 'user-1',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'user',
    emailVerified: true,
  },
};

function setup(session: AuthSession | null = SESSION) {
  const store = new Map<string, string>();

  const storage: IStorageService = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    remove: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(async () => {
      store.clear();
    }),
  };

  const analytics = {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    pageView: vi.fn(),
    getFeatureFlags: vi.fn().mockResolvedValue({}),
    onFeatureFlags: vi.fn().mockReturnValue(() => {}),
  } as unknown as AnalyticsService;

  const repository = {
    login: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    socialLogin: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue(session),
    forgotPassword: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthRepository;

  const service = new AuthService(repository, createAuthStore(), analytics, storage);

  return { service, analytics, repository, storage };
}

/** Lets the not-awaited identify/capture chain in `login()` settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AuthService analytics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('identifies the user and captures a sign-in on login', async () => {
    const { service, analytics } = setup();

    await service.login({ email: 'ada@example.com', password: 'pw' });
    await flush();

    expect(analytics.identify).toHaveBeenCalledWith('user-1', {
      email: 'ada@example.com',
      name: 'Ada Lovelace',
    });
    expect(analytics.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.USER_SIGNED_IN, {
      method: 'password',
    });
  });

  it('still captures the event when the session lookup fails', async () => {
    const { service, analytics, repository } = setup();
    vi.mocked(repository.getSession).mockRejectedValueOnce(new Error('offline'));

    await service.login({ email: 'ada@example.com', password: 'pw' });
    await flush();

    expect(analytics.identify).not.toHaveBeenCalled();
    expect(analytics.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.USER_SIGNED_IN, {
      method: 'password',
    });
  });

  // Restoring a session happens on every page load; counting it as a sign-in
  // would inflate the metric badly.
  it('identifies on session restore without emitting a sign-in', async () => {
    const { service, analytics } = setup();

    await service.restoreSession();

    expect(analytics.identify).toHaveBeenCalledWith('user-1', expect.anything());
    expect(analytics.capture).not.toHaveBeenCalled();
  });

  // The API refuses a provider identity it has never seen unless the caller
  // asks to register, so an intent dropped on the way through would turn the
  // register screen's Google button into one that can only ever fail.
  it('passes the sign-up intent through to the client', async () => {
    const { service, repository } = setup();

    await service.socialLogin('google', 'sign-up');

    expect(repository.socialLogin).toHaveBeenCalledWith('google', 'sign-up');
  });

  it('leaves the intent unset for a plain sign-in', async () => {
    const { service, repository } = setup();

    await service.socialLogin('google');

    expect(repository.socialLogin).toHaveBeenCalledWith('google', undefined);
  });

  it('captures the sign-in when an OAuth round-trip completes', async () => {
    const { service, analytics } = setup();

    await service.socialLogin('google');
    await service.restoreSession();

    expect(analytics.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.USER_SIGNED_IN, {
      method: 'google',
    });
  });

  it('does not re-emit the social sign-in on a later restore', async () => {
    const { service, analytics } = setup();

    await service.socialLogin('github');
    await service.restoreSession();
    vi.mocked(analytics.capture).mockClear();

    await service.restoreSession();

    expect(analytics.capture).not.toHaveBeenCalled();
  });

  // An abandoned OAuth attempt must not relabel a later password login.
  it('drops the pending marker when the user signs in with a password instead', async () => {
    const { service, analytics } = setup();

    await service.socialLogin('google');
    await service.login({ email: 'ada@example.com', password: 'pw' });
    await flush();
    vi.mocked(analytics.capture).mockClear();

    await service.restoreSession();

    expect(analytics.capture).not.toHaveBeenCalled();
  });

  // A logout that lands while the post-login session lookup is still in flight
  // must win: otherwise the late continuation re-identifies the browser as the
  // user who just left, and on a shared device the next person's activity is
  // attributed to them.
  it('discards a pending identify when logout wins the race', async () => {
    const { service, analytics, repository } = setup();
    let resolveSession: (value: AuthSession) => void = () => {};
    vi.mocked(repository.getSession).mockReturnValueOnce(
      new Promise<AuthSession>((resolve) => {
        resolveSession = resolve;
      }),
    );

    await service.login({ email: 'ada@example.com', password: 'pw' });
    await service.logout();
    vi.mocked(analytics.capture).mockClear();

    // The login's session lookup only now comes back.
    resolveSession(SESSION);
    await flush();

    expect(analytics.identify).not.toHaveBeenCalled();
    expect(analytics.capture).not.toHaveBeenCalled();
  });

  it('captures the sign-out before clearing identity', async () => {
    const { service, analytics } = setup();
    const order: string[] = [];
    vi.mocked(analytics.capture).mockImplementation(() => {
      order.push('capture');
    });
    vi.mocked(analytics.reset).mockImplementation(() => {
      order.push('reset');
    });

    await service.logout();

    expect(order).toEqual(['capture', 'reset']);
  });
});
