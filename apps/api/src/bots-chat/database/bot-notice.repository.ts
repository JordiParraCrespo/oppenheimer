import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { Repository } from 'typeorm';
import { BotResource } from '../../bots/bots.resource';
import { BotNoticeMapper } from '../bot-notice.mapper';
import type { BotNoticeEntity } from '../domain/bot-notice.entity';
import { BotNoticeOrmEntity } from './bot-notice.orm-entity';
import type { BotNoticeRepositoryPort, NamedBotNotice } from './bot-notice.repository.port';

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

  async findInWorkspace(scope: AccessScope, limit: number): Promise<NamedBotNotice[]> {
    // IDX_bot_notice_org_updated, read backwards; the bot's name by PK_bot,
    // the composite key the notice already holds (and a notice whose bot is
    // gone is gone with it).
    const { entities, raw } = await this.scopedQuery(scope)
      .innerJoin('bot', 'bot', 'bot."organizationId" = notice."organizationId" AND bot.id = notice."botId"')
      .addSelect('bot.name', 'botName')
      .orderBy('notice.updatedAt', 'DESC')
      .addOrderBy('notice.id', 'DESC')
      .limit(limit)
      .getRawAndEntities<{ botName: string }>();
    return entities.map((record, index) => ({
      notice: this.mapper.toDomain(record),
      botName: String(raw[index]?.botName ?? ''),
    }));
  }
}
