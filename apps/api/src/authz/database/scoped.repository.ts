import type { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import type { AccessScope } from '../domain/access-scope.types';
import type { ResourceDefinition } from '../domain/resource-definition.types';

/**
 * Narrow a query to the rows an {@link AccessScope} can reach, using the column
 * mapping the resource declared.
 *
 * The organization key is applied conjunctively — a tenant boundary is not
 * something another dimension may override, a bypass included: a platform
 * operator acting in a workspace sees that workspace, and only a bypass with no
 * active organization reaches every tenant. Team / own / grant are applied
 * disjunctively: satisfying any one of them makes a row visible.
 *
 * **Fails closed.** If no dimension yields a clause, the caller can reach
 * nothing of this type and the query is made unsatisfiable. Returning the
 * builder untouched — the obvious implementation — would turn "no access" into
 * "unrestricted access", which is the single worst bug this function could
 * have.
 */
export function applyAccessScope<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  resource: ResourceDefinition,
  scope: AccessScope,
): SelectQueryBuilder<T> {
  const alias = qb.alias;
  const { keys, scopes } = resource;

  if (scopes.includes('organization') && keys.organization) {
    // A caller with no active organization can see no tenant-scoped row,
    // unless it is the platform tier acting globally.
    if (!scope.organizationId) return scope.bypass ? qb : qb.andWhere('1 = 0');
    qb.andWhere(`${alias}.${keys.organization} = :authzOrganizationId`, {
      authzOrganizationId: scope.organizationId,
    });
  }

  // A bypass skips the slice within the tenant, never the tenant itself.
  if (scope.bypass) return qb;

  // An 'all' grant short-circuits the disjunction: the caller reaches every row
  // of this type within the organization boundary already applied above.
  if (scopes.includes('grant') && scope.grants.get(resource.subject) === 'all') {
    return qb;
  }

  const clauses: string[] = [];
  const parameters: Record<string, unknown> = {};

  if (scopes.includes('team') && keys.team && scope.teamIds.length > 0) {
    clauses.push(`${alias}.${keys.team} IN (:...authzTeamIds)`);
    parameters.authzTeamIds = [...scope.teamIds];
  }

  if (scopes.includes('own') && keys.owner) {
    clauses.push(`${alias}.${keys.owner} = :authzUserId`);
    parameters.authzUserId = scope.userId;
  }

  if (scopes.includes('grant') && keys.id) {
    const granted = scope.grants.get(resource.subject);
    if (granted && granted !== 'all' && granted.size > 0) {
      clauses.push(`${alias}.${keys.id} IN (:...authzGrantIds)`);
      parameters.authzGrantIds = [...granted];
    }
  }

  // Organization-only resources are fully constrained by the clause above;
  // there is no narrowing dimension left to require.
  const hasNarrowingDimension =
    scopes.includes('team') || scopes.includes('own') || scopes.includes('grant');
  if (!hasNarrowingDimension) return qb;

  if (clauses.length === 0) return qb.andWhere('1 = 0');

  return qb.andWhere(`(${clauses.join(' OR ')})`, parameters);
}

/**
 * Base for a repository whose rows are scope-filtered.
 *
 * Extending this is the second and last thing a module does to get row-level
 * authorization — the first being its `defineResource` declaration. Every read
 * built through {@link scopedQuery} carries the caller's scope, derived from the
 * same column mapping the CASL conditions use, so the query and the ability can
 * never disagree.
 */
export abstract class ScopedRepositoryBase<Orm extends ObjectLiteral> {
  /** The declaration whose `keys` drive the generated predicate. */
  protected abstract readonly resource: ResourceDefinition;
  /** Alias used for the root table in generated queries. */
  protected abstract readonly alias: string;
  protected abstract readonly repository: Repository<Orm>;

  /**
   * A query narrowed to what `scope` can reach.
   *
   * Throws when handed no scope. This is not a development-only assertion: a
   * scope-enforced repository reached without a scope has no safe default, and
   * the alternative — returning unfiltered rows — is a cross-tenant leak that
   * no test would notice.
   */
  protected scopedQuery(scope: AccessScope | undefined | null): SelectQueryBuilder<Orm> {
    if (!scope) {
      throw new Error(
        `${this.constructor.name} is scope-enforced but was queried without an AccessScope. ` +
          'Pass the scope resolved for the request, or call unscopedQuery() with an explicit reason.',
      );
    }
    return applyAccessScope(this.repository.createQueryBuilder(this.alias), this.resource, scope);
  }

  /**
   * A deliberately unfiltered query.
   *
   * For the cases that genuinely have no caller — a background job, a migration
   * backfill, a cross-tenant platform report. The `reason` is required so these
   * are greppable and reviewable rather than indistinguishable from a mistake.
   */
  protected unscopedQuery(reason: string): SelectQueryBuilder<Orm> {
    if (!reason.trim()) {
      throw new Error('unscopedQuery() requires a reason describing why no scope applies');
    }
    return this.repository.createQueryBuilder(this.alias);
  }
}
