import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { In, IsNull, LessThan, type Repository } from 'typeorm';
import { BotResource } from '../../bots/bots.resource';
import { BotAttachmentMapper } from '../bot-attachment.mapper';
import type { BotAttachmentEntity } from '../domain/bot-attachment.entity';
import { BotAttachmentOrmEntity } from './bot-attachment.orm-entity';
import type { BotAttachmentRepositoryPort } from './bot-attachment.repository.port';

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
