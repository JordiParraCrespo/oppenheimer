import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { Repository } from 'typeorm';
import { BotResource } from '../../bots/bots.resource';
import { BotNoticeMapper } from '../bot-notice.mapper';
import type { BotNoticeEntity } from '../domain/bot-notice.entity';
import { BotNoticeOrmEntity } from './bot-notice.orm-entity';
import type { BotNoticeRepositoryPort } from './bot-notice.repository.port';

@Injectable()
export class BotNoticeRepository
  extends ScopedRepositoryBase<BotNoticeOrmEntity>
  implements BotNoticeRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'notice';

  constructor(
    @InjectRepository(BotNoticeOrmEntity)
    protected readonly repository: Repository<BotNoticeOrmEntity>,
    private readonly mapper: BotNoticeMapper,
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  async put(notice: BotNoticeEntity): Promise<void> {
    const record = this.mapper.toPersistence(notice);
    await this.outbox.transaction(async (manager) => {
      // UQ_bot_notice_bot: the bot's one row takes the new notice's id and line.
      await manager.query(
        `INSERT INTO bot_notice (id, "organizationId", "botId", text)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("organizationId", "botId")
         DO UPDATE SET id = EXCLUDED.id, text = EXCLUDED.text, "updatedAt" = now()`,
        [record.id, record.organizationId, record.botId, record.text],
      );
      await this.outbox.stageEvents(manager, notice.domainEvents);
    });
    notice.clearEvents();
  }

  async findInWorkspace(scope: AccessScope, limit: number): Promise<BotNoticeEntity[]> {
    // IDX_bot_notice_org_updated, read backwards.
    const records = await this.scopedQuery(scope)
      .orderBy('notice.updatedAt', 'DESC')
      .addOrderBy('notice.id', 'DESC')
      .take(limit)
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }
}
