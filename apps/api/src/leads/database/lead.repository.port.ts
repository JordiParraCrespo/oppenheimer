import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { LeadEntity } from '../domain/lead.entity';

/**
 * Port for persisting and querying the lead aggregate.
 *
 * Every read takes an {@link AccessScope}. Putting it in the signature is what
 * turns "this query is authorized" from a convention a handler has to remember
 * into something the compiler asks for — and the adapter throws rather than
 * falling back to an unfiltered query if one is ever missing.
 *
 * This deliberately does **not** extend `RepositoryPort<LeadEntity>`: that
 * interface's `findAll()` and `findOneById(id)` take no scope, and offering
 * them here would reintroduce exactly the unscoped reads the kernel exists to
 * make impossible.
 */
export interface LeadRepositoryPort {
  insert(entity: LeadEntity): Promise<void>;
  save(entity: LeadEntity): Promise<LeadEntity>;
  /** Leads the caller can reach, newest first. */
  findAll(scope: AccessScope): Promise<LeadEntity[]>;
  /** `None` both for a missing lead and for one outside the caller's scope. */
  findOneById(scope: AccessScope, id: string): Promise<Option<LeadEntity>>;
  countAll(scope: AccessScope): Promise<number>;
}
