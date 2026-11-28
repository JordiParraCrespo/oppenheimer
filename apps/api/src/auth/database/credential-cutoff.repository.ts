import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CredentialCutoffOrmEntity } from './credential-cutoff.orm-entity';
import type { CredentialCutoffRepositoryPort } from './credential-cutoff.repository.port';

/**
 * The account's cutoff by its id, a primary-key lookup. Shared with the OAuth
 * grant gate (`grantOwnerLookups`), which reads it on Better Auth's own pool
 * because the Better Auth hook it runs in can inject nothing.
 */
export const CREDENTIAL_CUTOFF_SQL = `SELECT "issuedBefore" FROM "credential_cutoff" WHERE "userId" = $1`;

/**
 * Read per scoped request, never cached: a cutoff that waited on a cache to
 * expire would be the window it exists to close. A primary-key lookup.
 */
@Injectable()
export class CredentialCutoffRepository implements CredentialCutoffRepositoryPort {
  constructor(
    @InjectRepository(CredentialCutoffOrmEntity)
    private readonly repository: Repository<CredentialCutoffOrmEntity>,
  ) {}

  async findCutoff(userId: string): Promise<Date | null> {
    const rows: Pick<CredentialCutoffOrmEntity, 'issuedBefore'>[] = await this.repository.query(
      CREDENTIAL_CUTOFF_SQL,
      [userId],
    );
    return rows[0]?.issuedBefore ?? null;
  }
}
