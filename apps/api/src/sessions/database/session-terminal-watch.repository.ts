import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import type { SessionTerminalWatchEntity } from '../domain/session-terminal-watch.entity';
import { SessionTerminalWatchMapper } from '../session-terminal-watch.mapper';
import { SessionTerminalWatchOrmEntity } from './session-terminal-watch.orm-entity';
import type { SessionTerminalWatchRepositoryPort } from './session-terminal-watch.repository.port';

@Injectable()
export class SessionTerminalWatchRepository implements SessionTerminalWatchRepositoryPort {
  constructor(
    @InjectRepository(SessionTerminalWatchOrmEntity)
    private readonly repository: Repository<SessionTerminalWatchOrmEntity>,
    private readonly mapper: SessionTerminalWatchMapper,
  ) {}

  insert(watch: SessionTerminalWatchEntity, max: number): Promise<'inserted' | 'full' | 'missing'> {
    // No domain events, so no outbox: the count and the insert share a lock on
    // the session row, so two watches racing for the last place cannot both land.
    return this.repository.manager.transaction(async (manager) => {
      const locked: unknown[] = await manager.query(
        `SELECT id FROM work_session WHERE "organizationId" = $1 AND id = $2 FOR NO KEY UPDATE`,
        [watch.organizationId, watch.sessionId],
      );
      if (locked.length === 0) return 'missing' as const;
      const held = await manager.countBy(SessionTerminalWatchOrmEntity, {
        organizationId: watch.organizationId,
        sessionId: watch.sessionId,
      });
      if (held >= max) return 'full' as const;
      await manager.insert(SessionTerminalWatchOrmEntity, this.mapper.toPersistence(watch));
      return 'inserted' as const;
    });
  }

  async findForSessions(
    organizationId: string,
    sessionIds: readonly string[],
  ): Promise<SessionTerminalWatchEntity[]> {
    if (sessionIds.length === 0) return [];
    const records = await this.repository.find({
      where: { organizationId, sessionId: In([...sessionIds]) },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOne(
    organizationId: string,
    sessionId: string,
    watchId: string,
  ): Promise<SessionTerminalWatchEntity | null> {
    const record = await this.repository.findOneBy({ organizationId, sessionId, id: watchId });
    return record ? this.mapper.toDomain(record) : null;
  }

  async recordMatches(organizationId: string, watchId: string, count: number): Promise<void> {
    // PK_session_terminal_watch; GREATEST so a late report never lowers it.
    await this.repository
      .createQueryBuilder()
      .update(SessionTerminalWatchOrmEntity)
      .set({ matches: () => 'GREATEST("matches", :count)' })
      .setParameter('count', count)
      .where('"organizationId" = :organizationId AND id = :watchId', { organizationId, watchId })
      .execute();
  }

  async delete(organizationId: string, sessionId: string, watchId: string): Promise<boolean> {
    const result = await this.repository.delete({ organizationId, sessionId, id: watchId });
    return (result.affected ?? 0) > 0;
  }
}
