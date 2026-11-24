import { expo } from '@better-auth/expo';
import type { BetterAuthPlugin } from 'better-auth';

/** The one variable the decision reads, passed in by name so the environment check sees the read. */
export interface MobileAppAuthEnv {
  MOBILE_SCHEME?: string;
}

/** What a deployment that serves the phone app adds to Better Auth. */
export interface MobileAppAuth {
  trustedOrigins: string[];
  plugins: BetterAuthPlugin[];
}

// RFC 3986's scheme grammar.
const SCHEME = /^[a-z][a-z0-9+.-]*$/i;

// Schemes that name the web, not an app: trusting `https://` would trust every
// site there is.
const WEB_SCHEMES = new Set(['http', 'https', 'ws', 'wss', 'file', 'data', 'javascript']);

/**
 * Better Auth's half of the phone app: the app's deep-link scheme as a trusted
 * origin, so a social sign-in or a password reset may end at
 * `${MOBILE_SCHEME}://`, and the Expo plugin, which hands the session to the
 * app on the way back.
 *
 * Opt-in, with no default. A custom scheme is not owned by anybody: on Android
 * any installed app can register `oppenheimer://` too and be offered the
 * redirect that carries the session. So a deployment that serves no phone app
 * trusts no scheme and loads no plugin, and one that does names its scheme in
 * `MOBILE_SCHEME`, where it is a choice somebody made.
 *
 * A value that is not a scheme, or names a web scheme, stops the boot: it
 * would otherwise either trust the web or leave the app's sign-in broken with
 * nothing saying why.
 */
export function mobileAppAuth(env: MobileAppAuthEnv): MobileAppAuth {
  const scheme = env.MOBILE_SCHEME;
  if (!scheme?.trim()) return { trustedOrigins: [], plugins: [] };
  if (!SCHEME.test(scheme) || WEB_SCHEMES.has(scheme.toLowerCase())) {
    throw new Error(
      `MOBILE_SCHEME must be the phone app's own URL scheme (letters, digits, "+", "-", "."), not "${scheme}".`,
    );
  }
  return { trustedOrigins: [`${scheme}://`], plugins: [expo()] };
}
