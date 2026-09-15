import type { Option } from 'oxide.ts';
import type { AccessGrantEntity } from '../domain/access-grant.entity';

/**
 * Port for the access-grant aggregate.
 *
 * Lookups are organization-bound rather than by bare id: a grant in another
 * tenant must read as missing, not forbidden, so ids cannot be probed.
 */
export interface AccessGrantRepositoryPort {
  insert(entity: AccessGrantEntity): Promise<void>;
  findOneInOrganization(organizationId: string, id: string): Promise<Option<AccessGrantEntity>>;
  findAllInOrganization(organizationId: string): Promise<AccessGrantEntity[]>;
  delete(entity: AccessGrantEntity): Promise<boolean>;
  /**
   * Unexpired grants reaching any of these principals — the scope resolver's
   * hot path. Expiry is evaluated by the database so a skewed node cannot
   * extend a grant.
   */
  findActiveForPrincipals(
    organizationId: string,
    principals: readonly { principalType: string; principalId: string }[],
  ): Promise<AccessGrantEntity[]>;
}
