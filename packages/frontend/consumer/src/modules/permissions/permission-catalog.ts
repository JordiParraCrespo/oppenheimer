import type { PermissionGroup, Scope } from '@oppenheimer/shared';

/**
 * The permission catalog plus what the signed-in user may grant
 * (`GET /tokens/permissions`, served by the API's api-tokens module).
 */
export interface PermissionCatalog {
  groups: PermissionGroup[];
  grantable: Scope[];
}
