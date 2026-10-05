import { heyApiSdk } from '@oppenheimer/api-client';
import { MapApiError, unwrapBody } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import type { PermissionCatalog } from './permission-catalog';
import { PermissionsErrors } from './permissions.errors';

@injectable()
export class PermissionsRepository {
  /** Only the server can answer the grantable subset: it depends on the caller's roles. */
  @MapApiError(PermissionsErrors.FETCH_CATALOG_FAILED)
  async catalog(): Promise<PermissionCatalog> {
    const result = await unwrapBody(
      heyApiSdk.findGrantablePermissions(),
      PermissionsErrors.FETCH_CATALOG_FAILED,
    );

    return { groups: result.groups, grantable: result.grantable };
  }
}
