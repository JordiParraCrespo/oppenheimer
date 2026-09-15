import type { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import type { ResourceDefinition } from '../registry/resource-definition';
import type { AccessScope } from './access-scope';
import { applyAccessScope } from './apply-access-scope';

/**
 * Base for a repository whose rows are scope-filtered.
 *
 * Extending this is the second and last thing a module does to get row-level
 * authorization — the first being its `defineResource` declaration. Every read
 * built through {@link scopedQuery} carries the caller's scope, derived from the
 * same column mapping the CASL conditions use, so the query and the ability can
 * never disagree.
 *
 * The point is that forgetting is not an option. `scopedQuery` **throws**
 * without a scope rather than quietly returning everything, and the deliberate
 * way out is named and requires a reason.
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
