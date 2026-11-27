import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CredentialCutoffOrmEntity } from './credential-cutoff.orm-entity';
import type { CredentialCutoffRepositoryPort } from './credential-cutoff.repository.port';

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
    const row = await this.repository.findOneBy({ userId });
    return row?.issuedBefore ?? null;
  }
}
