import { AggregateRoot } from './aggregate-root.base';
import type { CreateEntityProps } from './entity.base';

/** What a versioned aggregate is rehydrated from: the row's props and the version it holds. */
export interface CreateVersionedEntityProps<T> extends CreateEntityProps<T> {
  /** The row's `version` column. A new aggregate starts at 1, the column's default. */
  version?: number;
}

/**
 * The default aggregate for a row more than one writer can change: it carries
 * the version the row held when it was loaded, and its repository writes it
 * with `writeVersioned`, an `UPDATE … WHERE id AND version` that refuses a
 * write made on a state someone has since replaced.
 *
 * The version is the repository's to move, never a domain method's: a
 * write that won calls `markVersionWritten()` after its transaction
 * commits, so a second write on the same instance is conditioned on what
 * the first one stored.
 */
export abstract class VersionedAggregateRoot<EntityProps> extends AggregateRoot<EntityProps> {
  private _version: number;

  constructor(create: CreateVersionedEntityProps<EntityProps>) {
    super(create);
    this._version = create.version ?? 1;
  }

  get version(): number {
    return this._version;
  }

  markVersionWritten(): void {
    this._version += 1;
  }
}
