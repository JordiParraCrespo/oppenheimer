import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import type { Repository } from 'typeorm';
import type { SessionShareLinkEntity } from '../domain/session-share-link.entity';
import { SessionShareLinkMapper } from '../session-share-link.mapper';
import { SessionShareLinkOrmEntity } from './session-share-link.orm-entity';
import type { SessionShareLinkRepositoryPort } from './session-share-link.repository.port';

@Injectable()
export class SessionShareLinkRepository implements SessionShareLinkRepositoryPort {
  constructor(
    @InjectRepository(SessionShareLinkOrmEntity)
    private readonly repository: Repository<SessionShareLinkOrmEntity>,
    private readonly mapper: SessionShareLinkMapper,
  ) {}

  async insertWithinLimit(
    link: SessionShareLinkEntity,
    limit: number,
    now: Date,
  ): Promise<'inserted' | 'limit_reached'> {
    // No domain events, so no outbox: a plain transaction holds the lock.
    return this.repository.manager.transaction(async (manager) => {
      // One mint per session at a time, so two at once cannot both count
      // the same free slot. "Live" is `SessionShareLinkEntity.isLive` in SQL:
      // not revoked, and no expiry or one still ahead.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `session_share_link:${link.sessionId}`,
      ]);
      const [{ live }]: { live: number }[] = await manager.query(
        `SELECT count(*)::int AS live FROM session_share_link
          WHERE "organizationId" = $1 AND "sessionId" = $2 AND "revokedAt" IS NULL
            AND ("expiresAt" IS NULL OR "expiresAt" > $3)`,
        [link.organizationId, link.sessionId, now],
      );
      if (live >= limit) return 'limit_reached' as const;
      await manager
        .getRepository(SessionShareLinkOrmEntity)
        .insert(this.mapper.toPersistence(link));
      return 'inserted' as const;
    });
  }

  async saveRevoked(link: SessionShareLinkEntity): Promise<void> {
    await this.repository.update({ id: link.id }, { revokedAt: link.revokedAt });
  }

  async findOneByTokenHash(tokenHash: string): Promise<Option<SessionShareLinkEntity>> {
    const record = await this.repository.findOneBy({ tokenHash });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneById(id: string): Promise<Option<SessionShareLinkEntity>> {
    const record = await this.repository.findOneBy({ id });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findBySession(
    organizationId: string,
    sessionId: string,
  ): Promise<SessionShareLinkEntity[]> {
    const records = await this.repository.find({
      where: { organizationId, sessionId },
      order: { createdAt: 'DESC' },
    });
    return records.map((record) => this.mapper.toDomain(record));
  }
}
