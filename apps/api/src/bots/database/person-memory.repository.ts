import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PersonAbout } from '../domain/bot.types';
import { PersonMemoryMapper } from '../person-memory.mapper';
import { PersonMemoryOrmEntity } from './person-memory.orm-entity';
import type { PersonMemoryRepositoryPort } from './person-memory.repository.port';

/**
 * One row per person per workspace, read and written by its key
 * (`PK_person_memory`). Only its writer reaches it, through their own
 * scope, so a save is an upsert with no version: the last save wins.
 */
@Injectable()
export class PersonMemoryRepository implements PersonMemoryRepositoryPort {
  constructor(
    @InjectRepository(PersonMemoryOrmEntity)
    private readonly repository: Repository<PersonMemoryOrmEntity>,
    private readonly mapper: PersonMemoryMapper,
  ) {}

  async find(organizationId: string, userId: string): Promise<PersonAbout> {
    const record = await this.repository.findOneBy({ organizationId, userId });
    return record
      ? this.mapper.toDomain(record)
      : { organizationId, userId, about: '', updatedAt: null };
  }

  async put(organizationId: string, userId: string, about: string): Promise<PersonAbout> {
    const [record]: PersonMemoryOrmEntity[] = await this.repository.query(
      `INSERT INTO person_memory ("organizationId", "userId", about)
       VALUES ($1, $2, $3)
       ON CONFLICT ("organizationId", "userId")
       DO UPDATE SET about = EXCLUDED.about, "updatedAt" = now()
       RETURNING *`,
      [organizationId, userId, about],
    );
    return this.mapper.toDomain(record);
  }
}
