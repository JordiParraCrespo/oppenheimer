import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { WhatsappChatGrantEntity } from '../domain/whatsapp-chat-grant.entity';
import { WhatsappChatGrantMapper } from '../whatsapp-chat-grant.mapper';
import { WhatsappChatGrantOrmEntity } from './whatsapp-chat-grant.orm-entity';
import type {
  WhatsappChatGrantRepositoryPort,
  WhatsappGrantsOf,
} from './whatsapp-chat-grant.repository.port';

@Injectable()
export class WhatsappChatGrantRepository implements WhatsappChatGrantRepositoryPort {
  constructor(
    @InjectRepository(WhatsappChatGrantOrmEntity)
    private readonly repository: Repository<WhatsappChatGrantOrmEntity>,
    private readonly mapper: WhatsappChatGrantMapper,
  ) {}

  async findAll(of: WhatsappGrantsOf): Promise<WhatsappChatGrantEntity[]> {
    const records = await this.repository.find({
      where: { organizationId: of.organizationId, accountId: of.accountId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findById(of: WhatsappGrantsOf, id: string): Promise<Option<WhatsappChatGrantEntity>> {
    const record = await this.repository.findOneBy({
      organizationId: of.organizationId,
      accountId: of.accountId,
      id,
    });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findByChat(of: WhatsappGrantsOf, chatId: string): Promise<Option<WhatsappChatGrantEntity>> {
    const record = await this.repository.findOneBy({
      organizationId: of.organizationId,
      accountId: of.accountId,
      chatId,
    });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  count(of: WhatsappGrantsOf): Promise<number> {
    return this.repository.countBy({
      organizationId: of.organizationId,
      accountId: of.accountId,
    });
  }

  async insert(grant: WhatsappChatGrantEntity): Promise<'inserted' | 'taken'> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .values(this.mapper.toPersistence(grant))
      .orIgnore()
      .returning(['id'])
      .execute();
    return (result.raw as unknown[]).length === 1 ? 'inserted' : 'taken';
  }

  async save(grant: WhatsappChatGrantEntity): Promise<void> {
    await this.repository.update(
      { id: grant.id, organizationId: grant.organizationId, accountId: grant.accountId },
      { botId: grant.botId, chatName: grant.chatName },
    );
  }

  async delete(grant: WhatsappChatGrantEntity): Promise<void> {
    await this.repository.delete({
      id: grant.id,
      organizationId: grant.organizationId,
      accountId: grant.accountId,
    });
  }
}
