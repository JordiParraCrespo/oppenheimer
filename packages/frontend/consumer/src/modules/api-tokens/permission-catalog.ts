import type { PermissionGroup, Scope } from '@oppenheimer/shared';

/**
 * The permission catalog plus what the signed-in user may grant, as the API's
 * api-tokens module serves it (`GET /tokens/permissions`). The console mints
 * no tokens; OAuth consent reads this to name the scopes a client asks for.
 */
export interface PermissionCatalog {
  groups: PermissionGroup[];
  grantable: Scope[];
}
