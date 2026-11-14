import { expoClient } from '@better-auth/expo/client';
import { sharedClientPlugins, toAuthSession, unwrap } from '@oppenheimer/auth/client';
import type { IAuthClient } from '@oppenheimer/frontend-core';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

// Resolved once here and imported by `oppenheimer.ts`, so the auth client and
// the REST client can never default to two different hosts.
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

// Must match the `scheme` in app.config.ts and MOBILE_SCHEME on the API so
// OAuth and password-reset deep links resolve back into the app.
const scheme = process.env.EXPO_PUBLIC_MOBILE_SCHEME ?? 'oppenheimer';

const expo = expoClient({
  scheme,
  storagePrefix: 'oppenheimer',
  storage: SecureStore,
});

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

  async signInSocial(provider) {
    // Opens an in-app browser and deep-links back via the app scheme.
    unwrap(
      await authClient.signIn.social({
        provider,
        callbackURL: `${scheme}://`,
        // Relative on purpose: the Expo client plugin turns a leading-slash
        // path into a deep link with `Linking.createURL`, which is what makes
        // it resolve in a dev client (`exp://…/--/login`) as well as a
        // standalone build.
        errorCallbackURL: '/login',
        // The API refuses a provider identity that has no account here
        // (`disableImplicitSignUp`). The app has no sign-up screen: an account
        // is made on the web, where its workspace is named.
        requestSignUp: false,
      }),
    );
  },

  async signOut() {
    await authClient.signOut();
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
