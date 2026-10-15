import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { DataSource, type EntityManager, In, Repository } from 'typeorm';
import { BotResource } from '../../bots/bots.resource';
import { BotMessageMapper } from '../bot-message.mapper';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import { BotMessageOrmEntity } from './bot-message.orm-entity';
import type { BotMessageRepositoryPort } from './bot-message.repository.port';

/** How much of a message the sidebar's line keeps. */
const PREVIEW_MAX = 200;

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
    await this.dataSource.transaction((manager) =>
      insertMessageWithin(manager, this.mapper, message),
    );
  }

  async saveSteps(message: BotMessageEntity): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(BotMessageOrmEntity)
      .set({ steps: () => ':steps::jsonb' })
      .setParameter('steps', JSON.stringify(message.steps))
      .where('id = :id AND "organizationId" = :organizationId', {
        id: message.id,
        organizationId: message.organizationId,
      })
      .execute();
  }

  async findConversation(
    scope: AccessScope,
    botId: string,
    limit: number,
  ): Promise<BotMessageEntity[]> {
    // IDX_bot_message_bot, read backwards.
    const records = await this.scopedQuery(scope)
      .andWhere('message.botId = :botId', { botId })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.position', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(limit)
      .getMany();
    return records.reverse().map((record) => this.mapper.toDomain(record));
  }

  async findOpening(organizationId: string, turnId: string): Promise<BotMessageEntity | null> {
    // IDX_bot_message_turn.
    const record = await this.repository.findOne({
      where: { organizationId, turnId, role: In(['user', 'event']) },
      order: { position: 'ASC' },
    });
    return record ? this.mapper.toDomain(record) : null;
  }

  async findHistory(
    organizationId: string,
    botId: string,
    turnId: string,
    limit: number,
  ): Promise<BotMessageEntity[]> {
    // IDX_bot_message_bot: the bot's messages before this turn was sent.
    const records = await this.repository
      .createQueryBuilder('message')
      .where('message.organizationId = :organizationId AND message.botId = :botId', {
        organizationId,
        botId,
      })
      .andWhere('message.turnId <> :turnId', { turnId })
      .andWhere(`message.role <> 'activity'`)
      .andWhere(
        `message.createdAt < (SELECT t."createdAt" FROM bot_turn t WHERE t."organizationId" = :organizationId AND t.id = :turnId)`,
      )
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.position', 'DESC')
      .take(limit)
      .getMany();
    return records.reverse().map((record) => this.mapper.toDomain(record));
  }
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
  await manager.query(
    `INSERT INTO bot_message (id, "organizationId", "botId", "turnId", "role", "content", "steps", "position", "event")
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb)`,
    [
      record.id,
      record.organizationId,
      record.botId,
      record.turnId,
      record.role,
      record.content,
      JSON.stringify(record.steps),
      record.position,
      record.event ? JSON.stringify(record.event) : null,
    ],
  );
  // The sidebar's line is a conversation's words: an activity line or an event is neither.
  if (message.role === 'activity' || message.role === 'event') return;
  await manager.query(
    `UPDATE bot SET "lastMessageAt" = now(), "lastMessagePreview" = left($3, ${PREVIEW_MAX})
      WHERE "organizationId" = $1 AND id = $2`,
    [message.organizationId, message.botId, message.content.replace(/\s+/g, ' ').trim()],
  );
}
