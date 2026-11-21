import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { whatsappKnownChatsUnderCap } from '../domain/whatsapp-chat-route.policy';
import type { WhatsappKnownChat } from '../domain/whatsapp-message.types';
import { WhatsappKnownChatMapper } from '../whatsapp-known-chat.mapper';
import { WhatsappAccountOrmEntity } from './whatsapp-account.orm-entity';
import type { WhatsappGrantsOf } from './whatsapp-chat-grant.repository.port';
import { WhatsappKnownChatOrmEntity } from './whatsapp-known-chat.orm-entity';
import type { WhatsappKnownChatRepositoryPort } from './whatsapp-known-chat.repository.port';

@Injectable()
export class WhatsappKnownChatRepository implements WhatsappKnownChatRepositoryPort {
  constructor(
    @InjectRepository(WhatsappKnownChatOrmEntity)
    private readonly repository: Repository<WhatsappKnownChatOrmEntity>,
    private readonly mapper: WhatsappKnownChatMapper,
  ) {}

  async findAll(of: WhatsappGrantsOf, limit: number): Promise<WhatsappKnownChat[]> {
    const records = await this.repository.find({
      where: { organizationId: of.organizationId, accountId: of.accountId },
      order: { chatName: 'ASC', chatId: 'ASC' },
      take: limit,
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async record(
    of: WhatsappGrantsOf,
    chats: readonly WhatsappKnownChat[],
    max: number,
    staleBefore: Date,
  ): Promise<void> {
    if (chats.length === 0) return;
    await this.repository.manager.transaction(async (manager) => {
      // The number's row, locked: frames of one report arrive side by side,
      // and each counts what is kept before it adds to it, so they take turns
      // or two of them fill the same room under the cap.
      await manager
        .getRepository(WhatsappAccountOrmEntity)
        .createQueryBuilder('account')
        .setLock('pessimistic_write')
        .where('account.organizationId = :organizationId AND account.id = :accountId', of)
        .getOne();
      const repository = manager.getRepository(WhatsappKnownChatOrmEntity);
      await repository.delete({
        organizationId: of.organizationId,
        accountId: of.accountId,
        updatedAt: LessThan(staleBefore),
      });
      const known = new Set(
        (
          await repository.find({
            select: { chatId: true },
            where: { organizationId: of.organizationId, accountId: of.accountId },
          })
        ).map((record) => record.chatId),
      );
      const kept = whatsappKnownChatsUnderCap(known, chats, max);
      if (kept.length === 0) return;
      await repository
        .createQueryBuilder()
        .insert()
        .values(kept.map((chat) => this.mapper.toPersistence(of, chat)))
        .orUpdate(['chatKind', 'chatName', 'updatedAt'], ['accountId', 'chatId'])
        .execute();
    });
  }
}
