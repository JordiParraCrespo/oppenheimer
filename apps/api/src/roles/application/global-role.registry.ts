import { Inject, Injectable } from '@nestjs/common';
import type { PermissionDefinition } from '@oppenheimer/shared';
import type { RoleRepositoryPort } from '../database/role.repository.port';
import { ROLE_REPOSITORY } from '../roles.di-tokens';

/** The global roles as they stood at one catalog version. */
interface Snapshot {
  version: string;
  byName: ReadonlyMap<string, readonly PermissionDefinition[]>;
}

/**
 * Every global role (`organizationId IS NULL`), held in this process and tagged with
 * the `role_catalog_version` it was loaded at, so the platform roles on `user.role`
 * resolve from memory rather than a query per name per request.
 *
 * No polling timer: the caller hands in the catalog version it just read, and a
 * snapshot at any other version is reloaded first. A global role edit bumps that
 * version in its transaction, so no replica applies a revoked permission past its next
 * request.
 *
 * Reloads are single-flight per version. A failed load is not remembered and the stale
 * snapshot is never served in its place, so the request fails as a database error would
 * and the next one retries.
 */
@Injectable()
export class GlobalRoleRegistry {
  private snapshot: Snapshot | null = null;
  private loading: { version: string; promise: Promise<Snapshot> } | null = null;

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roles: RoleRepositoryPort,
  ) {}

  /**
   * The permissions of the global role named `name` at `version`, or `null`
   * when no global role has that name.
   */
  async permissionsOf(
    name: string,
    version: string,
  ): Promise<readonly PermissionDefinition[] | null> {
    const snapshot = await this.at(version);
    return snapshot.byName.get(name) ?? null;
  }

  private at(version: string): Promise<Snapshot> {
    if (this.snapshot?.version === version) return Promise.resolve(this.snapshot);
    if (this.loading?.version === version) return this.loading.promise;

    const promise: Promise<Snapshot> = this.load(version)
      .then((snapshot) => {
        // A slower load for an older version must not replace a newer one.
        if (!this.snapshot || BigInt(snapshot.version) >= BigInt(this.snapshot.version)) {
          this.snapshot = snapshot;
        }
        return snapshot;
      })
      .finally(() => {
        if (this.loading?.promise === promise) this.loading = null;
      });
    this.loading = { version, promise };
    return promise;
  }

  /**
   * Read after the version was: a write that commits in between makes the
   * rows newer than the tag, which only costs the next request a reload.
   */
  private async load(version: string): Promise<Snapshot> {
    const roles = await this.roles.findGlobal();
    return {
      version,
      byName: new Map(
        roles.map((role) => [
          role.name,
          role.permissions.map((permission) => permission.toDefinition()),
        ]),
      ),
    };
  }
}
