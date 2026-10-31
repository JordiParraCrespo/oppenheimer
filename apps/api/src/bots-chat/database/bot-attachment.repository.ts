import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import { type EntityManager, In, IsNull, LessThan, type Repository } from 'typeorm';
import { ScopedRepositoryBase } from '../../authz/database/scoped.repository';
import { BotResource } from '../../bots/bots.resource';
import { BotAttachmentMapper } from '../bot-attachment.mapper';
import {
  BOT_ATTACHMENT_SEND_WINDOW_MS,
  type BotAttachmentEntity,
} from '../domain/bot-attachment.entity';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import { BotAttachmentOrmEntity } from './bot-attachment.orm-entity';
import type { BotAttachmentRepositoryPort } from './bot-attachment.repository.port';

/**
 * Marks the message's images as carried by it, in the caller's transaction
 * (the send's enqueue, which inserts the message first, for the foreign
 * key). This is the one place the rule of who may send an image lives: each
 * is claimed only if it is the sender's own upload to the message's bot, no
 * message carries it yet, and it was uploaded inside the send window, so an
 * image the sweep may be deleting is never claimed. Whether every one was
 * claimed; the caller rolls back when not.
 */
export async function claimAttachmentsWithin(
  manager: EntityManager,
  message: BotMessageEntity,
  senderId: string,
  sentAt: Date,
): Promise<boolean> {
  const ids = message.attachments.map((attachment) => attachment.id);
  if (ids.length === 0) return true;
  const uploadedAfter = new Date(sentAt.getTime() - BOT_ATTACHMENT_SEND_WINDOW_MS);
  // PK_bot_attachment.
  const [, affected]: [unknown[], number] = await manager.query(
    `UPDATE bot_attachment SET "messageId" = $1, "updatedAt" = now()
      WHERE id = ANY($2::uuid[]) AND "organizationId" = $3 AND "botId" = $4
        AND "messageId" IS NULL AND "createdAt" > $5 AND "uploadedByUserId" = $6`,
    [message.id, ids, message.organizationId, message.botId, uploadedAfter, senderId],
  );
  return affected === ids.length;
}

/**
 * Marks the images a bot showed (`show_image`) as carried by its message,
 * in the message's insert: the bot's own, stored by no person, of the
 * message's bot and carried by nothing yet. One the sweep took first is
 * left out, and the chat says it cannot be loaded.
 */
export async function claimShownWithin(
  manager: EntityManager,
  message: BotMessageEntity,
): Promise<void> {
  const ids = message.attachments.map((attachment) => attachment.id);
  if (ids.length === 0) return;
  // PK_bot_attachment.
  await manager.query(
    `UPDATE bot_attachment SET "messageId" = $1, "updatedAt" = now()
      WHERE id = ANY($2::uuid[]) AND "organizationId" = $3 AND "botId" = $4
        AND "messageId" IS NULL AND "uploadedByUserId" IS NULL`,
    [message.id, ids, message.organizationId, message.botId],
  );
}

@Injectable()
export class BotAttachmentRepository
  extends ScopedRepositoryBase<BotAttachmentOrmEntity>
  implements BotAttachmentRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'attachment';

  constructor(
    @InjectRepository(BotAttachmentOrmEntity)
    protected readonly repository: Repository<BotAttachmentOrmEntity>,
    private readonly mapper: BotAttachmentMapper,
  ) {
    super();
  }

  async insert(attachment: BotAttachmentEntity): Promise<void> {
    await this.repository.insert(this.mapper.toPersistence(attachment));
  }

  async findForBot(
    organizationId: string,
    botId: string,
    id: string,
  ): Promise<Option<BotAttachmentEntity>> {
    // PK_bot_attachment.
    const record = await this.repository.findOne({ where: { id, organizationId, botId } });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findManyForBot(
    organizationId: string,
    botId: string,
    ids: readonly string[],
  ): Promise<BotAttachmentEntity[]> {
    if (ids.length === 0) return [];
    // PK_bot_attachment.
    const records = await this.repository.find({
      where: { id: In([...ids]), organizationId, botId },
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findForMessage(organizationId: string, messageId: string): Promise<BotAttachmentEntity[]> {
    // IDX_bot_attachment_message.
    const records = await this.repository.find({ where: { messageId, organizationId } });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findUnclaimedBefore(cutoff: Date, limit: number): Promise<BotAttachmentEntity[]> {
    // IDX_bot_attachment_unclaimed.
    const records = await this.repository.find({
      where: { messageId: IsNull(), createdAt: LessThan(cutoff) },
      order: { createdAt: 'ASC' },
      take: limit,
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async deleteUnclaimed(ids: readonly string[]): Promise<number> {
    if (ids.length === 0) return 0;
    // A send that claimed one since it was read keeps it.
    const result = await this.repository.delete({ id: In([...ids]), messageId: IsNull() });
    return result.affected ?? 0;
  }
}
