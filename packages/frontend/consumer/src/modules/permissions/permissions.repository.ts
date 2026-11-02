import { heyApiSdk } from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import type { PermissionCatalog } from './permission-catalog';
import { PermissionsErrors } from './permissions.errors';

@injectable()
export class PermissionsRepository {
  /** Only the server can answer the grantable subset: it depends on the caller's roles. */
  catalog(): Promise<PermissionCatalog> {
    return callApi(PermissionsErrors.FETCH_CATALOG_FAILED, async (api) => {
      const result = await api.body(heyApiSdk.findGrantablePermissions());

      return { groups: result.groups, grantable: result.grantable };
    });
  }
}
