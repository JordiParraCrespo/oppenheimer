import {
  consumeSessionPreload,
  sharedClientPlugins,
  toAuthSession,
  unwrap,
} from '@oppenheimer/auth/client';
import type { IAuthClient } from '@oppenheimer/frontend-core';
import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth browser client. Authentication is cookie-based: the API sets an
 * httpOnly session cookie which the browser sends automatically on subsequent
 * requests (`credentials: include`). The Vite dev server proxies `/api` to the
 * API, keeping web and API same-origin so the cookie is sent without
 * cross-site restrictions.
 */
const apiBaseUrl = import.meta.env.VITE_API_URL ?? '';

/**
 * Better Auth rejects a relative `baseURL`, but same-origin is this app's
 * intended default — with no `VITE_API_URL` the path is just `/api/auth`,
 * which threw `Invalid base URL` and left the page blank before any UI
 * mounted. Resolving against the current origin keeps the zero-config path
 * working and still lets an absolute `VITE_API_URL` win, since `new URL()`
 * ignores the base when the input is already absolute.
 */
const authBaseUrl = new URL(`${apiBaseUrl}/api/auth`, window.location.origin).toString();

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  // The shared plugin set (additional user fields, admin, organizations) comes
  // from @oppenheimer/auth so the client types stay in lockstep with the server.
  plugins: [...sharedClientPlugins()],
});

export const webAuthClient: IAuthClient = {
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
    const url = (path: string) => new URL(path, window.location.origin).toString();

    // Redirects the browser to the provider and back to /sessions — but only
    // when the call to start the round-trip succeeds. It is the one method
    // here that used to skip `unwrap`, so a provider the API rejected resolved
    // as if it had worked and the screen had nothing to show.
    unwrap(
      await authClient.signIn.social({
        provider,
        // Signing in returns to the console; signing *up* has a workspace to
        // name first, the same first-run flow the email form opens.
        callbackURL: url(intent === 'sign-up' ? '/onboarding/workspace' : '/sessions'),
        // A failed round-trip comes back here with `?error=<code>` appended, so
        // it has to land on the screen the person actually started from —
        // otherwise a rejected sign-up reports itself on the login screen,
        // which would then bounce them back to register in a loop.
        errorCallbackURL: url(intent === 'sign-up' ? '/register' : '/login'),
        // The API refuses a provider identity that has no account here
        // (`disableImplicitSignUp`), and this flag is the only thing that lifts
        // that refusal. Only the register screen sets it: pressing "Continue
        // with Google" to *sign in* must not quietly create an account.
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
        redirectTo: `${window.location.origin}/reset-password`,
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
    // `public/session-preload.js` starts this request from <head>, so on app
    // start the answer is usually already in hand. Only for a same-origin API:
    // with VITE_API_URL pointing elsewhere, the preload would have asked a
    // different backend than this client talks to.
    if (!apiBaseUrl) {
      const preloaded = await consumeSessionPreload();
      if (preloaded !== undefined) return preloaded;
    }

    return toAuthSession(await authClient.getSession());
  },

  // On web the browser sends the session cookie automatically.
  async getAuthHeaders() {
    return {};
  },
};
