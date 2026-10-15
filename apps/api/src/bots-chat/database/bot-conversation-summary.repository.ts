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
    const won = await this.writeVersioned(this.mapper.toPersistence(summary));
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

  /**
   * The one write of a summary, as one statement that owns the column list
   * and the guard. `$4` names the cutoff message, read within the same
   * workspace and bot, and the cutoff's time is taken from its row (`m`), so
   * it keeps the database's microseconds.
   *
   * - Version 0, never stored: an insert that loses to any summary stored
   *   meanwhile (`ON CONFLICT DO NOTHING`).
   * - Otherwise: an update of the row at the version it was read at, and
   *   only to a later cutoff, so a racing or stale write never moves it back.
   *
   * Whether it won: exactly one row written.
   */
  private async writeVersioned(record: BotConversationSummaryOrmEntity): Promise<boolean> {
    const columns: [string, string][] = [
      ['content', '$3'],
      ['coversThroughMessageId', 'm.id'],
      ['coversThroughCreatedAt', 'm."createdAt"'],
    ];
    const cutoff = `m."organizationId" = $1 AND m."botId" = $2 AND m.id = $4`;
    const params = [
      record.organizationId,
      record.botId,
      record.content,
      record.coversThroughMessageId,
    ];
    if (record.version === 0) {
      // An INSERT answers its rows (typeorm.md).
      const rows: unknown[] = await this.repository.query(
        `INSERT INTO bot_conversation_summary ("organizationId", "botId", ${columns.map(([name]) => `"${name}"`).join(', ')}, "version")
         SELECT $1, $2, ${columns.map(([, value]) => value).join(', ')}, 1
           FROM bot_message m
          WHERE ${cutoff}
         ON CONFLICT ("organizationId", "botId") DO NOTHING
         RETURNING "version"`,
        params,
      );
      return rows.length === 1;
    }
    // An UPDATE answers `[rows, affected]` (typeorm.md).
    const [, affected]: [unknown[], number] = await this.repository.query(
      `UPDATE bot_conversation_summary s
          SET ${columns.map(([name, value]) => `"${name}" = ${value}`).join(', ')},
              "version" = s."version" + 1,
              "updatedAt" = now()
         FROM bot_message m
        WHERE s."organizationId" = $1 AND s."botId" = $2 AND s."version" = $5
          AND ${cutoff}
          AND m."createdAt" > s."coversThroughCreatedAt"`,
      [...params, record.version],
    );
    return affected === 1;
  }
}
