import { heyApiSdk } from '@oppenheimer/api-client';
import { MapApiError, unwrapBody } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { ApiTokensErrors } from './api-tokens.errors';
import type { PermissionCatalog } from './permission-catalog';

@injectable()
export class ApiTokensRepository {
  /**
   * The permission catalog plus the subset the caller may grant. Only the
   * server can answer the second part — it depends on the caller's roles.
   */
  @MapApiError(ApiTokensErrors.FETCH_PERMISSIONS_FAILED)
  async permissions(): Promise<PermissionCatalog> {
    const result = await unwrapBody(
      heyApiSdk.findGrantablePermissions(),
      ApiTokensErrors.FETCH_PERMISSIONS_FAILED,
    );

    return { groups: result.groups, grantable: result.grantable };
  }
}
