import type { FlagPlatform } from '@oppenheimer/shared/feature-flags';

/**
 * What an app says about itself when it asks for its flags: which platform it
 * is and which build. The API targets on both — a feature that needs new native
 * code is gated on `appVersion`, because old mobile binaries stay installed
 * for years — so each app passes its own to `OppenheimerApp.create`.
 *
 * Identity is *not* here: the API takes the user and organization from the
 * session, never from anything the client claims.
 */
export interface FeatureFlagsClientContext {
  platform?: Exclude<FlagPlatform, 'server'>;
  /** The client build, semver (`1.4.0`). */
  appVersion?: string;
}
