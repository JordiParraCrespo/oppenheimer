import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import type { Repository } from 'typeorm';
import type { SessionShareEntity } from '../domain/session-share.entity';
import { SessionShareMapper } from '../session-share.mapper';
import { SessionShareOrmEntity } from './session-share.orm-entity';
import type { SessionShareRepositoryPort } from './session-share.repository.port';

@Injectable()
export class SessionShareRepository implements SessionShareRepositoryPort {
  constructor(
    @InjectRepository(SessionShareOrmEntity)
    private readonly repository: Repository<SessionShareOrmEntity>,
    private readonly mapper: SessionShareMapper,
  ) {}

  async upsert(share: SessionShareEntity): Promise<SessionShareEntity> {
    const record = this.mapper.toPersistence(share);
    // No domain events, so no outbox. The conflict target is the session:
    // two first shares at once land as one row, at the first one's address.
    const [stored]: SessionShareOrmEntity[] = await this.repository.query(
      `INSERT INTO session_share
         (id, "organizationId", "sessionId", "sharedByUserId", slug, audience, access, people, "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ("organizationId", "sessionId") DO UPDATE SET
         "sharedByUserId" = EXCLUDED."sharedByUserId",
         audience = EXCLUDED.audience,
         access = EXCLUDED.access,
         people = EXCLUDED.people,
         "expiresAt" = EXCLUDED."expiresAt",
         "updatedAt" = now()
       RETURNING *`,
      [
        record.id,
        record.organizationId,
        record.sessionId,
        record.sharedByUserId,
        record.slug,
        record.audience,
        record.access,
        record.people,
        record.expiresAt,
      ],
    );
    return this.mapper.toDomain(stored);
  }

  async findOneBySession(
    organizationId: string,
    sessionId: string,
  ): Promise<Option<SessionShareEntity>> {
    return this.one(await this.repository.findOneBy({ organizationId, sessionId }));
  }

  async findOneBySlug(slug: string): Promise<Option<SessionShareEntity>> {
    return this.one(await this.repository.findOneBy({ slug }));
  }

  async findOneById(id: string): Promise<Option<SessionShareEntity>> {
    return this.one(await this.repository.findOneBy({ id }));
  }

  async delete(share: SessionShareEntity): Promise<void> {
    await this.repository.delete({ id: share.id });
  }

  private one(record: SessionShareOrmEntity | null): Option<SessionShareEntity> {
    return record ? Some(this.mapper.toDomain(record)) : None;
  }
}
