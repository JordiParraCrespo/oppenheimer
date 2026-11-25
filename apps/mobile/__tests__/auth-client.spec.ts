import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Signing out on the phone: a sign-out the server did not confirm leaves the
 * person signed in and says so, and one it confirmed leaves nothing behind.
 *
 * The regression: `signOut` resolved whatever Better Auth answered, so a 5xx
 * or no network showed the welcome screen while the session lived on. And the
 * Expo plugin empties its stored cookie before the request goes out, so after
 * a failure nothing on the phone could end that session, a retry included.
 *
 * The real Better Auth client and Expo plugin run here; only the native
 * modules (the secure store, react-native, expo-*) and the network are doubles.
 */

const secure = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItem: (key: string) => secure.get(key) ?? null,
  setItem: (key: string, value: string) => {
    secure.set(key, value);
  },
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: () => ({ remove: () => {} }), currentState: 'active' },
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: { scheme: 'oppenheimer' } } }));
vi.mock('expo-linking', () => ({ createURL: (path: string) => `oppenheimer://${path}` }));

const COOKIE_KEY = 'oppenheimer_cookie';
const SESSION_KEY = 'oppenheimer_session_data';
const storedCookie = JSON.stringify({
  'better-auth.session_token': { value: 'token.signature', expires: null },
});

function signedIn() {
  secure.set(COOKIE_KEY, storedCookie);
  secure.set(SESSION_KEY, JSON.stringify({ session: { id: 's1' }, user: { id: 'u1' } }));
}

type Client = typeof import('../lib/auth-client')['mobileAuthClient'];

describe('mobileAuthClient.signOut', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let auth: Client;

  // Loading the real Better Auth client takes seconds on a loaded machine, so
  // it happens once, here, with room for that, and after `fetch` is the fake
  // one the client keeps hold of.
  beforeAll(async () => {
    vi.stubGlobal('fetch', fetchMock);
    auth = (await import('../lib/auth-client')).mobileAuthClient;
  }, 60_000);

  beforeEach(() => {
    secure.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects when the server answers 5xx, and keeps the session to sign out with later', async () => {
    signedIn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'boom' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(auth.signOut()).rejects.toMatchObject({ status: 503 });

    expect(secure.get(COOKIE_KEY)).toBe(storedCookie);
    expect(await auth.getAuthHeaders()).toEqual({
      Cookie: expect.stringContaining('better-auth.session_token=token.signature'),
    });
  });

  it('rejects when the request never arrives, and keeps the session', async () => {
    signedIn();
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(auth.signOut()).rejects.toThrow();

    expect(secure.get(COOKIE_KEY)).toBe(storedCookie);
  });

  it('sends the stored session with the request and forgets it once the server confirms', async () => {
    signedIn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await auth.signOut();

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('cookie')).toContain(
      'better-auth.session_token=token.signature',
    );
    expect(secure.get(COOKIE_KEY)).toBe('{}');
    expect(await auth.getAuthHeaders()).toEqual({});
  });
});
