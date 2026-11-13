import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { DataSource, type EntityManager, In, Repository, type SelectQueryBuilder } from 'typeorm';
import { BotResource } from '../../bots/bots.resource';
import { BotMessageMapper } from '../bot-message.mapper';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { SummarizableMessage } from '../domain/bot-summary.policy';
import { claimShownWithin } from './bot-attachment.repository';
import { BotMessageOrmEntity } from './bot-message.orm-entity';
import { type BotMessageRepositoryPort, UnstorableStepsError } from './bot-message.repository.port';
import { BotTurnOrmEntity } from './bot-turn.orm-entity';

/** How much of a message the sidebar's line keeps. */
const PREVIEW_MAX = 200;

/** The sidebar's line of a message's words (`content`, an SQL expression): one line, cut. */
const previewOf = (content: string) =>
  `left(btrim(regexp_replace(${content}, '\\s+', ' ', 'g')), ${PREVIEW_MAX})`;

@Injectable()
export class BotMessageRepository
  extends ScopedRepositoryBase<BotMessageOrmEntity>
  implements BotMessageRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'message';

  constructor(
    @InjectRepository(BotMessageOrmEntity)
    protected readonly repository: Repository<BotMessageOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: BotMessageMapper,
  ) {
    super();
  }

  async insert(message: BotMessageEntity): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await insertMessageWithin(manager, this.mapper, message);
      // The images a bot showed; yours are claimed by the send, by its own rule.
      if (message.role === 'assistant') await claimShownWithin(manager, message);
    });
  }

  async insertOnce(message: BotMessageEntity): Promise<boolean> {
    await ensureConsoleWithin(this.dataSource.manager, message);
    // At the time it happened, not now; a bot deleted since leaves the line
    // nowhere to go, and nothing is stored.
    const stored: { id: string }[] = await this.dataSource.query(
      `INSERT INTO bot_message (${MESSAGE_COLUMNS}, "createdAt")
       SELECT ${MESSAGE_VALUES}, $12
        WHERE EXISTS (SELECT 1 FROM bot_conversation WHERE "organizationId" = $2 AND id = $11)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [...messageParameters(this.mapper.toPersistence(message)), message.createdAt],
    );
    return stored.length === 1;
  }

  async saveSteps(message: BotMessageEntity): Promise<void> {
    // The mapper's steps, so they are what an insert writes: cleaned for Postgres.
    const { steps } = this.mapper.toPersistence(message);
    try {
      await this.repository
        .createQueryBuilder()
        .update(BotMessageOrmEntity)
        .set({ steps: () => ':steps::jsonb' })
        .setParameter('steps', JSON.stringify(steps))
        .where('id = :id AND "organizationId" = :organizationId', {
          id: message.id,
          organizationId: message.organizationId,
        })
        .execute();
    } catch (error) {
      throw isDataException(error) ? new UnstorableStepsError(error) : error;
    }
  }

  async placeSteer(
    turn: { organizationId: string; id: string },
    steer: { messageId: string; position: number },
    at: Date,
  ): Promise<void> {
    // PK_bot_message.
    await this.repository
      .createQueryBuilder()
      .update(BotMessageOrmEntity)
      .set({ position: steer.position, createdAt: at })
      .where('id = :messageId AND "organizationId" = :organizationId AND "turnId" = :turnId', {
        messageId: steer.messageId,
        organizationId: turn.organizationId,
        turnId: turn.id,
      })
      .execute();
  }

  async removeTurnWords(
    turn: { organizationId: string; id: string; botId: string },
    messageIds: readonly string[],
  ): Promise<void> {
    if (messageIds.length === 0) return;
    await this.dataSource.transaction(async (manager) => {
      // PK_bot_message; only the turn's own words.
      await manager.query(
        `DELETE FROM bot_message
          WHERE "organizationId" = $1 AND "turnId" = $2 AND role = 'assistant' AND id = ANY($3::uuid[])`,
        [turn.organizationId, turn.id, messageIds],
      );
      // The sidebar's line, as insertMessageWithin keeps it: the newest words left.
      await manager.query(
        `UPDATE bot SET ("lastMessageAt", "lastMessagePreview") = (
           SELECT message."createdAt", ${previewOf('message.content')}
             FROM bot_message message
            WHERE message."organizationId" = $1 AND message."botId" = $2
              AND message.role IN ('user', 'assistant') AND message.content <> ''
            ORDER BY message."createdAt" DESC, message.position DESC
            LIMIT 1)
          WHERE "organizationId" = $1 AND id = $2`,
        [turn.organizationId, turn.botId],
      );
    });
  }

  async findConversation(
    scope: AccessScope,
    conversationId: string,
    limit: number,
  ): Promise<BotMessageEntity[]> {
    // IDX_bot_message_conversation, read backwards.
    const records = await this.scopedQuery(scope)
      .andWhere('message.conversationId = :conversationId', { conversationId })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.position', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(limit)
      .getMany();
    return records.reverse().map((record) => this.mapper.toDomain(record));
  }

  async search(
    scope: AccessScope,
    conversationId: string,
    query: string,
    limit: number,
  ): Promise<BotMessageEntity[]> {
    // IDX_bot_message_search for the words, IDX_bot_message_conversation for
    // the conversation; the role predicate is the index's own, so the planner
    // can use it.
    const records = await this.scopedQuery(scope)
      .andWhere('message.conversationId = :conversationId', { conversationId })
      .andWhere(`message.role IN ('user', 'assistant')`)
      .andWhere(
        `to_tsvector('simple', message.content) @@ websearch_to_tsquery('simple', :query)`,
        {
          query,
        },
      )
      .orderBy(
        `ts_rank(to_tsvector('simple', message.content), websearch_to_tsquery('simple', :query))`,
        'DESC',
      )
      .addOrderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(limit)
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async countConversation(scope: AccessScope, conversationId: string): Promise<number> {
    // IDX_bot_message_conversation.
    return this.scopedQuery(scope)
      .andWhere('message.conversationId = :conversationId', { conversationId })
      .andWhere(`message.role <> 'activity'`)
      .getCount();
  }

  async countTextBlocks(
    scope: AccessScope,
    turnIds: readonly string[],
  ): Promise<Map<string, number>> {
    if (turnIds.length === 0) return new Map();
    // IDX_bot_message_turn.
    const rows: { turnId: string; count: string }[] = await this.scopedQuery(scope)
      .select('message.turnId', 'turnId')
      .addSelect('COUNT(*)', 'count')
      .andWhere('message.turnId IN (:...turnIds)', { turnIds })
      .andWhere(`message.role = 'assistant'`)
      .andWhere(`message.content <> ''`)
      .groupBy('message.turnId')
      .getRawMany();
    return new Map(rows.map((row) => [row.turnId, Number(row.count)]));
  }

  async findExportPage(
    scope: AccessScope,
    conversationId: string,
    after: BotMessageEntity | null,
    limit: number,
  ): Promise<BotMessageEntity[]> {
    // IDX_bot_message_conversation, read forwards; the cursor is the stored
    // row's own time, so a page boundary keeps the database's microseconds.
    const query = this.scopedQuery(scope).andWhere('message.conversationId = :conversationId', {
      conversationId,
    });
    if (after) {
      query.andWhere(
        `(message.createdAt, message.position, message.id) > (SELECT c."createdAt", c."position", c.id FROM bot_message c WHERE c."organizationId" = :cursorOrganizationId AND c.id = :afterId)`,
        { cursorOrganizationId: after.organizationId, afterId: after.id },
      );
    }
    const records = await query
      .orderBy('message.createdAt', 'ASC')
      .addOrderBy('message.position', 'ASC')
      .addOrderBy('message.id', 'ASC')
      .take(limit)
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOpening(organizationId: string, turnId: string): Promise<BotMessageEntity | null> {
    // IDX_bot_message_turn.
    const record = await this.repository.findOne({
      where: { organizationId, turnId, role: In(['user', 'event']) },
      order: { position: 'ASC' },
    });
    return record ? this.mapper.toDomain(record) : null;
  }

  async findTurnTexts(organizationId: string, turnId: string): Promise<string[]> {
    // IDX_bot_message_turn.
    const records = await this.repository.find({
      where: { organizationId, turnId, role: 'assistant' },
      order: { position: 'ASC' },
      select: { id: true, content: true, position: true },
    });
    return records.map((record) => record.content);
  }

  async turnCalledTools(organizationId: string, turnId: string): Promise<boolean> {
    // IDX_bot_message_turn.
    const rows: unknown[] = await this.repository.query(
      `SELECT 1 FROM bot_message
        WHERE "organizationId" = $1 AND "turnId" = $2 AND jsonb_array_length(steps) > 0
        LIMIT 1`,
      [organizationId, turnId],
    );
    return rows.length > 0;
  }

  async findHistory(
    organizationId: string,
    conversationId: string,
    turnId: string,
    afterMessageId: string | null,
    limit: number,
  ): Promise<BotMessageEntity[]> {
    // IDX_bot_message_conversation: the conversation's messages before this
    // turn was sent.
    const query = this.repository
      .createQueryBuilder('message')
      .where(
        'message.organizationId = :organizationId AND message.conversationId = :conversationId',
        { organizationId, conversationId },
      )
      .andWhere('(message.turnId IS NULL OR message.turnId <> :turnId)', { turnId })
      .andWhere(
        `message.createdAt < (SELECT t."createdAt" FROM bot_turn t WHERE t."organizationId" = :organizationId AND t.id = :turnId)`,
      );
    const records = await after(query, afterMessageId)
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.position', 'DESC')
      .take(limit)
      .getMany();
    return records.reverse().map((record) => this.mapper.toDomain(record));
  }

  async findRecent(
    organizationId: string,
    botId: string,
    limit: number,
  ): Promise<BotMessageEntity[]> {
    // IDX_bot_message_bot, scanned backwards.
    const records = await this.repository
      .createQueryBuilder('message')
      .where('message.organizationId = :organizationId AND message.botId = :botId', {
        organizationId,
        botId,
      })
      .andWhere(`message.role <> 'activity'`)
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.position', 'DESC')
      .take(limit)
      .getMany();
    return records.reverse().map((record) => this.mapper.toDomain(record));
  }

  async findUncovered(
    organizationId: string,
    botId: string,
    afterMessageId: string | null,
    limit: number,
  ): Promise<SummarizableMessage[]> {
    // IDX_bot_message_conversation, read forwards from the cutoff: the
    // console chat's, the one the summary covers; each message's turn by its
    // primary key, for whether it has ended. A line outside any turn has
    // nothing to wait for.
    const query = this.repository
      .createQueryBuilder('message')
      .leftJoin(
        BotTurnOrmEntity,
        'turn',
        'turn.organizationId = message.organizationId AND turn.id = message.turnId',
      )
      .addSelect('turn.status', 'turnStatus')
      .where(
        'message.organizationId = :organizationId AND message.conversationId = :conversationId',
        { organizationId, conversationId: botId },
      );
    const { entities, raw } = await after(query, afterMessageId)
      .orderBy('message.createdAt', 'ASC')
      .addOrderBy('message.position', 'ASC')
      .addOrderBy('message.id', 'ASC')
      .limit(limit)
      .getRawAndEntities<{ turnStatus: string }>();
    return entities.map((record, index) =>
      this.mapper.toSummarizable(record, raw[index]?.turnStatus),
    );
  }
}

/**
 * Only the messages stored after `afterMessageId`, compared on the stored
 * time itself so the cutoff keeps the database's microseconds; every message
 * when there is no cutoff.
 */
function after(
  query: SelectQueryBuilder<BotMessageOrmEntity>,
  afterMessageId: string | null,
): SelectQueryBuilder<BotMessageOrmEntity> {
  if (!afterMessageId) return query;
  return query.andWhere(
    `message.createdAt > (SELECT c."createdAt" FROM bot_message c WHERE c."organizationId" = :organizationId AND c.id = :afterMessageId)`,
    { afterMessageId },
  );
}

/**
 * Postgres refused a value, not the statement: SQLSTATE class 22 (a NUL,
 * an escape `jsonb` will not take, malformed JSON). A lost connection or a
 * broken constraint is not one.
 */
export function isDataException(error: unknown): boolean {
  const own = error as { code?: unknown };
  const driver = (error as { driverError?: typeof own }).driverError ?? own;
  return typeof driver.code === 'string' && driver.code.startsWith('22');
}

/** What a message is written as, by every writer of `bot_message`, in this order. */
const MESSAGE_COLUMNS = `id, "organizationId", "botId", "turnId", "role", "content", "steps", "position", "event", "attachments", "conversationId"`;
const MESSAGE_VALUES = '$1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10::jsonb, $11';

function messageParameters(record: BotMessageOrmEntity): unknown[] {
  return [
    record.id,
    record.organizationId,
    record.botId,
    record.turnId,
    record.role,
    record.content,
    JSON.stringify(record.steps),
    record.position,
    record.event ? JSON.stringify(record.event) : null,
    JSON.stringify(record.attachments),
    record.conversationId,
  ];
}

/**
 * A message, and when it is yours or the bot's text, the bot's last message
 * for the sidebar; in the caller's transaction.
 */
export async function insertMessageWithin(
  manager: EntityManager,
  mapper: BotMessageMapper,
  message: BotMessageEntity,
): Promise<void> {
  const record = mapper.toPersistence(message);
  await ensureConsoleWithin(manager, message);
  await manager.query(
    `INSERT INTO bot_message (${MESSAGE_COLUMNS}) VALUES (${MESSAGE_VALUES})`,
    messageParameters(record),
  );
  // The sidebar's line is a conversation's words: an activity line, an event
  // or the images a bot showed are none, and leave the bot's last words there.
  if (message.role === 'activity' || message.role === 'event') return;
  if (message.role === 'assistant' && !message.content) return;
  await manager.query(
    `UPDATE bot SET "lastMessageAt" = now(), "lastMessagePreview" = ${previewOf('$3::text')}
      WHERE "organizationId" = $1 AND id = $2`,
    [message.organizationId, message.botId, record.content],
  );
}

/**
 * The bot's console chat as a `bot_conversation` row, made the first time
 * anything is written to it (the migration made it for every bot that
 * existed); a bot deleted since gets none. Nothing for a channel's
 * conversation, which is made before its first turn.
 */
export async function ensureConsoleWithin(
  manager: EntityManager,
  owner: { organizationId: string; botId: string; conversationId: string },
): Promise<void> {
  if (owner.conversationId !== owner.botId) return;
  // PK_bot_conversation.
  await manager.query(
    `INSERT INTO bot_conversation (id, "organizationId", "botId", kind)
     SELECT $2, $1, $2, 'console'
      WHERE EXISTS (SELECT 1 FROM bot WHERE "organizationId" = $1 AND id = $2)
     ON CONFLICT (id) DO NOTHING`,
    [owner.organizationId, owner.botId],
  );
}
