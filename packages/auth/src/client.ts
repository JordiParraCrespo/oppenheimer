import { adminClient, inferAdditionalFields, organizationClient } from 'better-auth/client/plugins';
import { organizationSharedOptions } from './organization-options';
import { userAdditionalFields } from './user-fields';

/**
 * The client halves of the server's `admin` and `organization` plugins in
 * `apps/api/src/auth/infrastructure/better-auth.config.ts`, plus its user
 * fields. Platform-specific plugins, if a client needs any, are prepended by
 * the app.
 *
 * A factory rather than a shared array so each client gets fresh plugin
 * instances. The return type is deliberately inferred — and this entry ships
 * as TypeScript source (see the package README) — so Better Auth's type
 * inference flows through to each app's `createAuthClient` call.
 */
export function sharedClientPlugins() {
  return [
    inferAdditionalFields({ user: userAdditionalFields }),
    adminClient(),
    organizationClient(organizationSharedOptions),
  ] as const;
}

export { organizationSharedOptions } from './organization-options';
export type {
  AuthSession,
  AuthSessionUser,
} from './session';
export { toAuthSession } from './session';
export { consumeSessionPreload } from './session-preload';
export { type AuthErrorResult, AuthRequestError, unwrap } from './unwrap';
export { userAdditionalFields } from './user-fields';
