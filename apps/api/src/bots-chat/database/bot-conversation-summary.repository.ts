import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import type { Repository } from 'typeorm';
import { BotResource } from '../../bots/bots.resource';
import { BotConversationSummaryMapper } from '../bot-conversation-summary.mapper';
import type { BotConversationSummaryEntity } from '../domain/bot-conversation-summary.entity';
import { BotConversationSummaryOrmEntity } from './bot-conversation-summary.orm-entity';
import type { BotConversationSummaryRepositoryPort } from './bot-conversation-summary.repository.port';

/** The job that folds a bot's oldest uncovered messages into its summary; its payload is `{ organizationId, botId }`. */
export const SUMMARIZE_BOT_CONVERSATION_JOB = 'summarize-bot-conversation';

@Injectable()
export class BotConversationSummaryRepository
  extends ScopedRepositoryBase<BotConversationSummaryOrmEntity>
  implements BotConversationSummaryRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'summary';

  constructor(
    @InjectRepository(BotConversationSummaryOrmEntity)
    protected readonly repository: Repository<BotConversationSummaryOrmEntity>,
    private readonly outbox: OutboxService,
    private readonly mapper: BotConversationSummaryMapper,
  ) {
    super();
  }

  async findForBot(
    organizationId: string,
    botId: string,
  ): Promise<Option<BotConversationSummaryEntity>> {
    // PK_bot_conversation_summary.
    const record = await this.repository.findOne({ where: { organizationId, botId } });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async save(summary: BotConversationSummaryEntity): Promise<boolean> {
    const record = this.mapper.toPersistence(summary);
    const won = record.version === 0 ? await this.insertFirst(record) : await this.revise(record);
    if (won) summary.markPersisted();
    return won;
  }

  async stageSummarize(
    organizationId: string,
    botId: string,
    correlationId: string | null,
  ): Promise<void> {
    await this.outbox.transaction((manager) =>
      this.outbox.stageJob(manager, {
        queue: QUEUE_NAMES.BOT_SUMMARIES,
        jobName: SUMMARIZE_BOT_CONVERSATION_JOB,
        payload: { organizationId, botId },
        reason: `bot ${botId}: its uncovered messages passed the summary threshold`,
        aggregateId: botId,
        correlationId,
      }),
    );
  }

  /** The bot's first summary; loses to any summary stored meanwhile. */
  private async insertFirst(record: BotConversationSummaryOrmEntity): Promise<boolean> {
    const rows: unknown[] = await this.repository.query(
      `INSERT INTO bot_conversation_summary
         ("organizationId", "botId", "content", "coversThroughMessageId", "coversThroughCreatedAt", "version")
       SELECT $1, $2, $3, m.id, m."createdAt", 1
         FROM bot_message m
        WHERE m."organizationId" = $1 AND m."botId" = $2 AND m.id = $4
       ON CONFLICT ("organizationId", "botId") DO NOTHING
       RETURNING "version"`,
      [record.organizationId, record.botId, record.content, record.coversThroughMessageId],
    );
    return rows.length === 1;
  }

  /** A revision of the row at the version it was read at, to a later cutoff only. */
  private async revise(record: BotConversationSummaryOrmEntity): Promise<boolean> {
    // An UPDATE answers `[rows, affected]` (typeorm.md).
    const [, affected]: [unknown[], number] = await this.repository.query(
      `UPDATE bot_conversation_summary s
          SET "content" = $3,
              "coversThroughMessageId" = m.id,
              "coversThroughCreatedAt" = m."createdAt",
              "version" = s."version" + 1,
              "updatedAt" = now()
         FROM bot_message m
        WHERE s."organizationId" = $1 AND s."botId" = $2 AND s."version" = $5
          AND m."organizationId" = $1 AND m."botId" = $2 AND m.id = $4
          AND m."createdAt" > s."coversThroughCreatedAt"`,
      [
        record.organizationId,
        record.botId,
        record.content,
        record.coversThroughMessageId,
        record.version,
      ],
    );
    return affected === 1;
  }
}
