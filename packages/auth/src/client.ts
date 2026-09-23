import { adminClient, inferAdditionalFields, organizationClient } from 'better-auth/client/plugins';
import { organizationSharedOptions } from './organization-options';
import { userAdditionalFields } from './user-fields';

/**
 * The client plugins every Oppenheimer Better Auth client shares, mirroring the
 * server's plugin set in `apps/api/src/auth/infrastructure/better-auth.config.ts`. Platform-specific
 * plugins, if a client needs any, are prepended by the app.
 *
 * A factory rather than a shared array so each client gets fresh plugin
 * instances. The return type is deliberately inferred — and this entry ships
 * as TypeScript source (see the package README) — so Better Auth's type
 * inference flows through to each app's `createAuthClient` call.
 */
export function sharedClientPlugins() {
  return [
    // Mirror the server's `user.additionalFields` so session/user types match.
    inferAdditionalFields({ user: userAdditionalFields }),
    // Super-admin operations (list/ban/impersonate/set-role) under
    // `authClient.admin.*`, and organizations/members/invitations/workspaces
    // (teams) under `authClient.organization.*`.
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
