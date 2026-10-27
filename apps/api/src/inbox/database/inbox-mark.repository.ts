import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { InboxMarkEntity } from '../domain/inbox-mark.entity';
import { InboxMarkMapper } from '../inbox-mark.mapper';
import { InboxMarkOrmEntity } from './inbox-mark.orm-entity';
import type { InboxMarkRepositoryPort } from './inbox-mark.repository.port';

/**
 * A person's marks, read and written by workspace and person, never by id:
 * the occurrence's key is what the console knows. Every read names the
 * caller, so another person's mark is never reached.
 */
@Injectable()
export class InboxMarkRepository implements InboxMarkRepositoryPort {
  constructor(
    @InjectRepository(InboxMarkOrmEntity)
    private readonly repository: Repository<InboxMarkOrmEntity>,
    private readonly mapper: InboxMarkMapper,
    private readonly outbox: OutboxService,
  ) {}

  async upsert(mark: InboxMarkEntity): Promise<void> {
    const record = this.mapper.toPersistence(mark);
    await this.outbox.transaction(async (manager) => {
      // UQ_inbox_mark_item: the occurrence's row keeps its id and createdAt.
      await manager.query(
        `INSERT INTO inbox_mark (id, "organizationId", "userId", "itemKey", mark, "until")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ("organizationId", "userId", "itemKey")
         DO UPDATE SET mark = EXCLUDED.mark, "until" = EXCLUDED."until", "updatedAt" = now()`,
        [
          record.id,
          record.organizationId,
          record.userId,
          record.itemKey,
          record.mark,
          record.until,
        ],
      );
      await this.outbox.stageEvents(manager, mark.domainEvents);
    });
    mark.clearEvents();
  }

  async findOne(
    organizationId: string,
    userId: string,
    itemKey: string,
  ): Promise<Option<InboxMarkEntity>> {
    // UQ_inbox_mark_item.
    const record = await this.repository.findOne({ where: { organizationId, userId, itemKey } });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findInForce(
    organizationId: string,
    userId: string,
    now: Date,
    limit: number,
  ): Promise<InboxMarkEntity[]> {
    // UQ_inbox_mark_item's prefix; a person's marks are few enough to sort.
    const records = await this.repository
      .createQueryBuilder('inbox')
      .where('inbox.organizationId = :organizationId AND inbox.userId = :userId', {
        organizationId,
        userId,
      })
      .andWhere(`(inbox.mark <> 'snoozed' OR inbox.until > :now)`, { now })
      .orderBy('inbox.updatedAt', 'DESC')
      .addOrderBy('inbox.id', 'DESC')
      .take(limit)
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async delete(mark: InboxMarkEntity): Promise<boolean> {
    const deleted = await this.outbox.transaction(async (manager) => {
      const result = await manager.getRepository(InboxMarkOrmEntity).delete({
        organizationId: mark.organizationId,
        userId: mark.userId,
        itemKey: mark.itemKey,
      });
      if ((result.affected ?? 0) === 0) return false;
      await this.outbox.stageEvents(manager, mark.domainEvents);
      return true;
    });
    if (deleted) mark.clearEvents();
    return deleted;
  }
}
