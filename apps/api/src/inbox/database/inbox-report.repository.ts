import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService } from '@oppenheimer/backend-ddd';
import type { InboxReportStatus } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { InboxReportEntity } from '../domain/inbox-report.entity';
import { InboxReportMapper } from '../inbox-report.mapper';
import { InboxReportOrmEntity } from './inbox-report.orm-entity';
import type { InboxReportRepositoryPort } from './inbox-report.repository.port';

/**
 * A workspace's reports. Every read names the workspace, so a report's id
 * alone never reaches another workspace's.
 */
@Injectable()
export class InboxReportRepository implements InboxReportRepositoryPort {
  constructor(
    @InjectRepository(InboxReportOrmEntity)
    private readonly repository: Repository<InboxReportOrmEntity>,
    private readonly mapper: InboxReportMapper,
    private readonly outbox: OutboxService,
  ) {}

  async insert(report: InboxReportEntity): Promise<void> {
    const record = this.mapper.toPersistence(report);
    await this.outbox.transaction(async (manager) => {
      await manager.getRepository(InboxReportOrmEntity).insert(record);
      await this.outbox.stageEvents(manager, report.domainEvents);
    });
    report.clearEvents();
  }

  async findOne(organizationId: string, id: string): Promise<Option<InboxReportEntity>> {
    // PK_inbox_report.
    const record = await this.repository.findOne({ where: { id, organizationId } });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findByStatus(
    organizationId: string,
    status: InboxReportStatus,
    limit: number,
  ): Promise<InboxReportEntity[]> {
    // IDX_inbox_report_org_status_created, scanned backwards.
    const records = await this.repository.find({
      where: { organizationId, status },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async saveAnswer(report: InboxReportEntity): Promise<boolean> {
    const saved = await this.outbox.transaction(async (manager) => {
      // PK_inbox_report; `status = 'open'` is what makes the answer the only one.
      const [, affected]: [unknown[], number] = await manager.query(
        `UPDATE inbox_report
            SET status = 'answered', answer = $1, "answeredByUserId" = $2, "answeredAt" = $3,
                "updatedAt" = now()
          WHERE id = $4 AND "organizationId" = $5 AND status = 'open'`,
        [
          report.answer,
          report.answeredByUserId,
          report.answeredAt,
          report.id,
          report.organizationId,
        ],
      );
      if (affected === 0) return false;
      await this.outbox.stageEvents(manager, report.domainEvents);
      return true;
    });
    if (saved) report.clearEvents();
    return saved;
  }
}
