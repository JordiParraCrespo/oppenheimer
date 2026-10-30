import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  WhatsappChat,
  WhatsappMessage,
  WhatsappMessageDraft,
} from '../domain/whatsapp-message.types';
import { WhatsappMessageMapper } from '../whatsapp-message.mapper';
import { WhatsappMessageOrmEntity } from './whatsapp-message.orm-entity';
import type {
  WhatsappAccountRef,
  WhatsappMessageRepositoryPort,
} from './whatsapp-message.repository.port';

@Injectable()
export class WhatsappMessageRepository implements WhatsappMessageRepositoryPort {
  constructor(
    @InjectRepository(WhatsappMessageOrmEntity)
    private readonly repository: Repository<WhatsappMessageOrmEntity>,
    private readonly mapper: WhatsappMessageMapper,
  ) {}

  async insertMany(messages: readonly WhatsappMessageDraft[]): Promise<void> {
    if (messages.length === 0) return;
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(WhatsappMessageOrmEntity)
      .values(messages.map((message) => this.mapper.toPersistence(message)))
      .orIgnore()
      .execute();
  }

  async recordBotSend(message: WhatsappMessageDraft): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(WhatsappMessageOrmEntity)
      .values(this.mapper.toPersistence(message))
      .orUpdate(['sentByBotId'], ['organizationId', 'accountId', 'chatId', 'externalId'])
      .execute();
  }

  /** A batch picked through `IDX_whatsapp_message_account_sent`, deleted by `ctid` (`database-design.md`). */
  async pruneBefore(account: WhatsappAccountRef, before: Date, limit: number): Promise<number> {
    const [, affected]: [unknown, number] = await this.repository.query(
      `DELETE FROM whatsapp_message WHERE ctid = ANY (ARRAY(
         SELECT ctid FROM whatsapp_message
          WHERE "organizationId" = $1 AND "accountId" = $2 AND "sentAt" < $3
          LIMIT $4))`,
      [account.organizationId, account.accountId, before, limit],
    );
    return affected;
  }

  async findChats(account: WhatsappAccountRef, limit: number): Promise<WhatsappChat[]> {
    // The newest row of each chat, then the chats by it: one pass over the
    // account's slice of `IDX_whatsapp_message_account_sent`.
    const rows: Array<
      WhatsappMessageOrmEntity & { messageCount: string; lastName: string | null }
    > = await this.repository.query(
      `SELECT * FROM (
           SELECT DISTINCT ON ("chatId") m.*,
                  count(*) OVER (PARTITION BY "chatId") AS "messageCount",
                  (array_agg("chatName") FILTER (WHERE "chatName" IS NOT NULL)
                     OVER (PARTITION BY "chatId" ORDER BY "sentAt" DESC
                           ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING))[1] AS "lastName"
             FROM whatsapp_message m
            WHERE "organizationId" = $1 AND "accountId" = $2
            ORDER BY "chatId", "sentAt" DESC, id DESC
         ) chats
         ORDER BY "sentAt" DESC
         LIMIT $3`,
      [account.organizationId, account.accountId, limit],
    );
    return rows.map((row) => ({
      accountId: row.accountId,
      chatId: row.chatId,
      chatKind: row.chatKind,
      chatName: row.lastName ?? row.chatName,
      messageCount: Number(row.messageCount),
      last: this.mapper.toDomain(row),
    }));
  }

  async findInChat(
    account: WhatsappAccountRef,
    chatId: string,
    limit: number,
    before: Date | null,
  ): Promise<WhatsappMessage[]> {
    const query = this.repository
      .createQueryBuilder('message')
      .where('message.organizationId = :organizationId', account)
      .andWhere('message.accountId = :accountId', account)
      .andWhere('message.chatId = :chatId', { chatId });
    if (before) query.andWhere('message.sentAt < :before', { before });
    const records = await query
      .orderBy('message.sentAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .limit(limit)
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async search(
    account: WhatsappAccountRef,
    query: string,
    limit: number,
  ): Promise<WhatsappMessage[]> {
    const records = await this.repository
      .createQueryBuilder('message')
      .where('message.organizationId = :organizationId', account)
      .andWhere('message.accountId = :accountId', account)
      .andWhere(`message.text ILIKE :pattern ESCAPE '\\'`, { pattern: `%${escapeLike(query)}%` })
      .orderBy('message.sentAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .limit(limit)
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async countBotSendsSince(account: WhatsappAccountRef, since: Date): Promise<number> {
    return this.repository
      .createQueryBuilder('message')
      .where('message.organizationId = :organizationId', account)
      .andWhere('message.accountId = :accountId', account)
      .andWhere('message.sentAt >= :since', { since })
      .andWhere('message.sentByBotId IS NOT NULL')
      .getCount();
  }
}

/** `%`, `_` and the escape itself, taken literally in an `ILIKE`. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
