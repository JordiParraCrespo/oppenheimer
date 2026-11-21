import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { whatsappKnownChatsUnderCap } from '../domain/whatsapp-chat-route.policy';
import type { WhatsappKnownChat } from '../domain/whatsapp-message.types';
import type { WhatsappGrantsOf } from './whatsapp-chat-grant.repository.port';
import { WhatsappKnownChatOrmEntity } from './whatsapp-known-chat.orm-entity';
import type { WhatsappKnownChatRepositoryPort } from './whatsapp-known-chat.repository.port';

@Injectable()
export class WhatsappKnownChatRepository implements WhatsappKnownChatRepositoryPort {
  constructor(
    @InjectRepository(WhatsappKnownChatOrmEntity)
    private readonly repository: Repository<WhatsappKnownChatOrmEntity>,
  ) {}

  async findAll(of: WhatsappGrantsOf, limit: number): Promise<WhatsappKnownChat[]> {
    const records = await this.repository.find({
      where: { organizationId: of.organizationId, accountId: of.accountId },
      order: { chatName: 'ASC', chatId: 'ASC' },
      take: limit,
    });
    return records.map((record) => ({
      chatId: record.chatId,
      chatKind: record.chatKind,
      chatName: record.chatName,
    }));
  }

  async record(
    of: WhatsappGrantsOf,
    chats: readonly WhatsappKnownChat[],
    max: number,
    staleBefore: Date,
  ): Promise<void> {
    if (chats.length === 0) return;
    await this.repository.manager.transaction(async (manager) => {
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
        .values(
          kept.map((chat) => ({
            organizationId: of.organizationId,
            accountId: of.accountId,
            chatId: chat.chatId,
            chatKind: chat.chatKind,
            chatName: chat.chatName,
            updatedAt: () => 'now()',
          })),
        )
        .orUpdate(['chatKind', 'chatName', 'updatedAt'], ['accountId', 'chatId'])
        .execute();
    });
  }
}
