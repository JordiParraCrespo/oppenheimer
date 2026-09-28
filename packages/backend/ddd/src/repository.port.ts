import type { Option } from 'oxide.ts';

/** One page of a list, with the total it was cut from. */
export class Paginated<T> {
  readonly count: number;
  readonly limit: number;
  readonly page: number;
  readonly data: readonly T[];

  constructor(props: Paginated<T>) {
    this.count = props.count;
    this.limit = props.limit;
    this.page = props.page;
    this.data = props.data;
  }
}

export type OrderBy = { field: string | true; param: 'asc' | 'desc' };

export type PaginatedQueryParams = {
  limit: number;
  page: number;
  offset: number;
  orderBy: OrderBy;
};

/**
 * The generic write-and-lookup surface of a non-tenant repository. Lists are
 * not part of it: a port that needs one declares it, bounded and with the
 * arguments it needs, and more specific queries live on the concrete port. A
 * write that spans several statements is one `OutboxService.transaction` in
 * the adapter, not a method callers wrap around repository calls.
 *
 * Tenant-scoped repositories do not extend this: every read there takes an
 * `AccessScope` (see `ScopedRepositoryBase` in `@oppenheimer/backend-authz`).
 */
export interface RepositoryPort<Entity> {
  insert(entity: Entity | Entity[]): Promise<void>;
  save(entity: Entity): Promise<Entity>;
  findOneById(id: string): Promise<Option<Entity>>;
  delete(entity: Entity): Promise<boolean>;
}
