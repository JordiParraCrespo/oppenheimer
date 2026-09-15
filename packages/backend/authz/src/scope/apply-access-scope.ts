import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { ResourceDefinition } from '../registry/resource-definition';
import type { AccessScope } from './access-scope';

/**
 * Narrow a query to the rows an {@link AccessScope} can reach, using the column
 * mapping the resource declared.
 *
 * The organization key is applied conjunctively — a tenant boundary is not
 * something another dimension may override. Team / own / grant are applied
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
  if (scope.bypass) return qb;

  const alias = qb.alias;
  const { keys, scopes } = resource;

  if (scopes.includes('organization') && keys.organization) {
    // A caller with no active organization can see no tenant-scoped row.
    if (!scope.organizationId) return qb.andWhere('1 = 0');
    qb.andWhere(`${alias}.${keys.organization} = :authzOrganizationId`, {
      authzOrganizationId: scope.organizationId,
    });
  }

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
