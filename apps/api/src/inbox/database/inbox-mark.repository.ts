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
    await this.upsertAll([mark]);
  }

  async upsertAll(marks: readonly InboxMarkEntity[]): Promise<void> {
    if (marks.length === 0) return;
    const records = marks.map((mark) => this.mapper.toPersistence(mark));
    await this.outbox.transaction(async (manager) => {
      // One statement for the set; UQ_inbox_mark_item keeps each occurrence's
      // row, its id and createdAt.
      await manager.query(
        `INSERT INTO inbox_mark (id, "organizationId", "userId", "itemKey", mark, "until")
         SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::uuid[], $4::varchar[], $5::varchar[], $6::timestamptz[])
         ON CONFLICT ("organizationId", "userId", "itemKey")
         DO UPDATE SET mark = EXCLUDED.mark, "until" = EXCLUDED."until", "updatedAt" = now()`,
        [
          records.map((record) => record.id),
          records.map((record) => record.organizationId),
          records.map((record) => record.userId),
          records.map((record) => record.itemKey),
          records.map((record) => record.mark),
          records.map((record) => record.until),
        ],
      );
      await this.outbox.stageEvents(
        manager,
        marks.flatMap((mark) => mark.domainEvents),
      );
    });
    for (const mark of marks) mark.clearEvents();
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

  async clear(
    organizationId: string,
    userId: string,
    itemKeys: readonly string[],
  ): Promise<number> {
    if (itemKeys.length === 0) return 0;
    return this.outbox.transaction(async (manager) => {
      // UQ_inbox_mark_item's prefix, then the keys; only the rows there were come back.
      const result = await manager
        .createQueryBuilder()
        .delete()
        .from(InboxMarkOrmEntity)
        .where('"organizationId" = :organizationId AND "userId" = :userId', {
          organizationId,
          userId,
        })
        .andWhere('"itemKey" IN (:...itemKeys)', { itemKeys: [...itemKeys] })
        .returning('*')
        .execute();
      const rows = result.raw as InboxMarkOrmEntity[];
      const removed = rows.map((row) => this.mapper.toDomain(row));
      for (const mark of removed) mark.remove();
      await this.outbox.stageEvents(
        manager,
        removed.flatMap((mark) => mark.domainEvents),
      );
      return removed.length;
    });
  }
}
