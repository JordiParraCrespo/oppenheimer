import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { type EntityManager, In, IsNull, LessThan, type Repository } from 'typeorm';
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
 * key): each only if no message carries it yet and it was uploaded inside
 * the send window, so an image the sweep may be deleting is never claimed.
 * Whether every one was claimed; the caller rolls back when not.
 */
export async function claimAttachmentsWithin(
  manager: EntityManager,
  message: BotMessageEntity,
  sentAt: Date,
): Promise<boolean> {
  const ids = message.attachments.map((attachment) => attachment.id);
  if (ids.length === 0) return true;
  const uploadedAfter = new Date(sentAt.getTime() - BOT_ATTACHMENT_SEND_WINDOW_MS);
  // PK_bot_attachment.
  const [, affected]: [unknown[], number] = await manager.query(
    `UPDATE bot_attachment SET "messageId" = $1, "updatedAt" = now()
      WHERE id = ANY($2::uuid[]) AND "organizationId" = $3 AND "botId" = $4
        AND "messageId" IS NULL AND "createdAt" > $5`,
    [message.id, ids, message.organizationId, message.botId, uploadedAfter],
  );
  return affected === ids.length;
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
