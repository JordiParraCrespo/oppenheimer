import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AggregateID, OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import {
  type FindOptionsWhere,
  IsNull,
  LessThanOrEqual,
  MoreThan,
  Not,
  type Repository,
} from 'typeorm';
import { ApiTokenMapper } from '../api-tokens.mapper';
import { type ApiTokenEntity, LAST_USED_GRANULARITY_MS } from '../domain/api-token.entity';
import { ApiTokenOrmEntity } from './api-token.orm-entity';
import type { ApiTokenRepositoryPort, InsertOutcome } from './api-token.repository.port';

/** How many revoked or expired tokens the list keeps, the latest first. */
export const INACTIVE_TOKENS_LISTED = 50;

/** A user's tokens that still authenticate at `now`: not revoked, not expired. */
function usableWhere(userId: string, now: Date): FindOptionsWhere<ApiTokenOrmEntity>[] {
  return [
    { userId, revokedAt: IsNull(), expiresAt: IsNull() },
    { userId, revokedAt: IsNull(), expiresAt: MoreThan(now) },
  ];
}

@Injectable()
export class ApiTokenRepository implements ApiTokenRepositoryPort {
  constructor(
    @InjectRepository(ApiTokenOrmEntity)
    private readonly repository: Repository<ApiTokenOrmEntity>,
    private readonly mapper: ApiTokenMapper,
    private readonly outbox: OutboxService,
  ) {}

  async save(entity: ApiTokenEntity): Promise<ApiTokenEntity> {
    const record = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(ApiTokenOrmEntity).save(this.mapper.toPersistence(entity)),
    );
    return this.mapper.toDomain(record);
  }

  async findOneById(id: string): Promise<Option<ApiTokenEntity>> {
    const record = await this.repository.findOneBy({ id });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByHash(tokenHash: string): Promise<Option<ApiTokenEntity>> {
    const record = await this.repository.findOneBy({ tokenHash });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findByUserId(userId: string, now: Date): Promise<ApiTokenEntity[]> {
    const [usable, spent] = await Promise.all([
      this.repository.find({ where: usableWhere(userId, now) }),
      this.repository.find({
        where: [
          { userId, revokedAt: Not(IsNull()) },
          { userId, expiresAt: LessThanOrEqual(now) },
        ],
        order: { createdAt: 'DESC', id: 'DESC' },
        take: INACTIVE_TOKENS_LISTED,
      }),
    ]);
    return [...usable, ...spent]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((record) => this.mapper.toDomain(record));
  }

  async insertWithinLimit(
    entity: ApiTokenEntity,
    limit: number,
    now: Date,
  ): Promise<InsertOutcome> {
    const record = this.mapper.toPersistence(entity);
    const outcome = await this.outbox.transaction(async (manager) => {
      // One mint per owner at a time: a concurrent request waits on this lock
      // until the transaction commits, then counts the token it added.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `api_token:${entity.userId}`,
      ]);
      const repository = manager.getRepository(ApiTokenOrmEntity);
      const active = await repository.count({ where: usableWhere(entity.userId, now) });
      if (active >= limit) return 'limit_reached' as const;
      // Cast around TypeORM's `QueryDeepPartialEntity` recursion, which cannot
      // represent the jsonb array columns.
      await repository.insert(record as Parameters<typeof repository.insert>[0]);
      await this.outbox.stageEvents(manager, entity.domainEvents);
      return 'inserted' as const;
    });
    if (outcome === 'inserted') entity.clearEvents();
    return outcome;
  }

  /**
   * A guarded raw update rather than `repository.update`: that would also bump
   * `updatedAt` (it is an `@UpdateDateColumn`), which means "when this token was
   * changed", and it would write every time.
   */
  async touchLastUsedAt(id: string, at: Date): Promise<void> {
    await this.repository.query(
      `UPDATE "api_token"
          SET "lastUsedAt" = $2
        WHERE "id" = $1
          AND ("lastUsedAt" IS NULL OR "lastUsedAt" <= $2::timestamptz - $3::interval)`,
      [id, at, `${LAST_USED_GRANULARITY_MS} milliseconds`],
    );
  }

  async delete(entity: ApiTokenEntity): Promise<boolean> {
    const result = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(ApiTokenOrmEntity).delete({
        id: entity.id as AggregateID,
      }),
    );
    return result.affected ? result.affected > 0 : false;
  }
}
