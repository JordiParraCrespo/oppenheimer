import { expoClient } from '@better-auth/expo/client';
import { sharedClientPlugins, toAuthSession, unwrap } from '@oppenheimer/auth/client';
import type { IAuthClient } from '@oppenheimer/frontend';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

// Must match the `scheme` in app.config.ts and MOBILE_SCHEME on the API so
// OAuth and password-reset deep links resolve back into the app.
const scheme = process.env.EXPO_PUBLIC_MOBILE_SCHEME ?? 'oppenheimer';

type CookieAuthClient = { getCookie(): string };

export const authClient = createAuthClient({
  baseURL: `${apiBaseUrl}/api/auth`,
  plugins: [
    // @better-auth/expo and better-auth currently publish structurally
    // incompatible BetterFetch generics even at the same package version.
    // The runtime plugin contract is compatible; erase only that duplicate
    // dependency type so the remaining plugins keep their inference.
    expoClient({
      scheme,
      storagePrefix: 'oppenheimer',
      storage: SecureStore,
    }) as never,
    // The shared plugin set (additional user fields, admin, organizations)
    // comes from @oppenheimer/auth so the client types stay in lockstep with the
    // server.
    ...sharedClientPlugins(),
  ],
});

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
        // (`disableImplicitSignUp`); only the register screen lifts it, so
        // signing in never silently creates an account.
        requestSignUp: intent === 'sign-up',
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

  async changePassword(currentPassword, newPassword) {
    unwrap(await authClient.changePassword({ currentPassword, newPassword }));
  },

  async getSession() {
    return toAuthSession(await authClient.getSession());
  },

  // Attach the Better Auth session cookie (stored in SecureStore) to the
  // generated REST client's requests.
  async getAuthHeaders(): Promise<Record<string, string>> {
    const cookie = (authClient as typeof authClient & CookieAuthClient).getCookie();
    return cookie ? { Cookie: cookie } : {};
  },
};
