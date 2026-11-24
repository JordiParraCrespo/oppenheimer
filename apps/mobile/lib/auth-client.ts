import { expoClient } from '@better-auth/expo/client';
import { sharedClientPlugins, toAuthSession, unwrap } from '@oppenheimer/auth/client';
import type { IAuthClient } from '@oppenheimer/frontend-core';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

// Resolved once here and imported by `oppenheimer.ts`, so the auth client and
// the REST client can never default to two different hosts.
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

// The console on the web: Terms and Privacy live there, and a workspace's
// address is printed under its host.
export const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';

// Must match the `scheme` in app.config.ts and MOBILE_SCHEME on the API so
// OAuth and password-reset deep links resolve back into the app.
const scheme = process.env.EXPO_PUBLIC_MOBILE_SCHEME ?? 'oppenheimer';

const storagePrefix = 'oppenheimer';

const expo = expoClient({
  scheme,
  storagePrefix,
  storage: SecureStore,
});

// The two SecureStore keys the Expo plugin keeps the session under, and what
// it writes to them on a sign-out (@better-auth/expo 1.6.25, `clearSessionCache`).
// A cookie too long for one key is split across `<key>.0..N` under a marker in
// the base key; the sign-out rewrites only the base key, so the base key's old
// value is the whole of what has to come back.
const STORED_SESSION_KEYS = [`${storagePrefix}_cookie`, `${storagePrefix}_session_data`];
const CLEARED = '{}';

/** What the Expo plugin adds to the client, read off its own declaration. */
type ExpoActions = ReturnType<typeof expo.getActions>;

const client = createAuthClient({
  baseURL: `${apiBaseUrl}/api/auth`,
  plugins: [
    // @better-auth/expo declares `getActions` against @better-fetch's
    // `BetterFetch` while better-auth's plugin type expects its own
    // `CreateFetchOption` generics, so the plugin is not assignable even at the
    // same versions (1.6.25, @better-fetch/fetch 1.3.1). It is widened to
    // better-auth's plugin type, not erased, so the plugins after it keep
    // their inference; what that widening drops, `ExpoActions` puts back below.
    expo as BetterAuthClientPlugin,
    // The shared plugin set (additional user fields, admin, organizations)
    // comes from @oppenheimer/auth so the client types stay in lockstep with the
    // server.
    ...sharedClientPlugins(),
  ],
});

export const authClient = client as typeof client & ExpoActions;

export const mobileAuthClient: IAuthClient = {
  async signIn(email, password) {
    unwrap(await authClient.signIn.email({ email, password }));
  },

  async signUp({ email, password, firstName, lastName }) {
    unwrap(
      await authClient.signUp.email({
        email,
        password,
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
      }),
    );
  },

  async signInSocial(provider, intent = 'sign-in') {
    // Opens an in-app browser and deep-links back via the app scheme.
    unwrap(
      await authClient.signIn.social({
        provider,
        callbackURL: `${scheme}://`,
        // Relative on purpose: the Expo client plugin turns a leading-slash
        // path into a deep link with `Linking.createURL`, which is what makes
        // it resolve in a dev client (`exp://…/--/login`) as well as a
        // standalone build.
        errorCallbackURL: intent === 'sign-up' ? '/register' : '/login',
        // The API refuses a provider identity that has no account here
        // (`disableImplicitSignUp`); only the Create account screen lifts it,
        // so signing in never silently creates an account.
        requestSignUp: intent === 'sign-up',
      }),
    );
  },

  async signOut() {
    // Unwrapped like every other call, as on the web: a sign-out the server
    // refused (or never heard) rejects, and the account sheet says so with the
    // person still signed in. The Expo plugin empties its stored cookie before
    // the request is sent, so a failure would otherwise leave the server's
    // session alive with nothing on the phone able to end it, a retry included.
    // What it held is put back, unless something has been stored since. A
    // network failure throws rather than answering `{ error }`.
    const held = STORED_SESSION_KEYS.map((key) => [key, SecureStore.getItem(key)] as const);
    const putBack = () => {
      for (const [key, value] of held) {
        if (value !== null && SecureStore.getItem(key) === CLEARED) SecureStore.setItem(key, value);
      }
    };
    let result: Awaited<ReturnType<typeof authClient.signOut>>;
    try {
      result = await authClient.signOut();
    } catch (error) {
      putBack();
      throw error;
    }
    if (result.error) putBack();
    unwrap(result);
  },

  async forgotPassword(email) {
    unwrap(
      await authClient.requestPasswordReset({
        email,
        redirectTo: `${scheme}://reset-password`,
      }),
    );
  },

  async resetPassword(token, newPassword) {
    unwrap(await authClient.resetPassword({ token, newPassword }));
  },

  async getSession() {
    return toAuthSession(await authClient.getSession());
  },

  // Attach the Better Auth session cookie (stored in SecureStore) to the
  // generated REST client's requests.
  async getAuthHeaders(): Promise<Record<string, string>> {
    const cookie = authClient.getCookie();
    return cookie ? { Cookie: cookie } : {};
  },
};
