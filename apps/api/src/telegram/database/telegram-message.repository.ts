import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type {
  TelegramChat,
  TelegramMessage,
  TelegramMessageDraft,
} from '../domain/telegram-message.types';
import { TelegramMessageMapper } from '../telegram-message.mapper';
import { TelegramMessageOrmEntity } from './telegram-message.orm-entity';
import type {
  TelegramAccountRef,
  TelegramMessageRepositoryPort,
} from './telegram-message.repository.port';

@Injectable()
export class TelegramMessageRepository implements TelegramMessageRepositoryPort {
  constructor(
    @InjectRepository(TelegramMessageOrmEntity)
    private readonly repository: Repository<TelegramMessageOrmEntity>,
    private readonly mapper: TelegramMessageMapper,
  ) {}

  async insertMany(messages: readonly TelegramMessageDraft[]): Promise<void> {
    if (messages.length === 0) return;
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(TelegramMessageOrmEntity)
      .values(messages.map((message) => this.mapper.toPersistence(message)))
      .orIgnore()
      .execute();
  }

  async recordBotSend(message: TelegramMessageDraft): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(TelegramMessageOrmEntity)
      .values(this.mapper.toPersistence(message))
      .orUpdate(['sentByBotId'], ['organizationId', 'accountId', 'chatId', 'externalId'])
      .execute();
  }

  /** A batch picked through `IDX_telegram_message_account_sent`, deleted by `ctid` (`database-design.md`). */
  async pruneBefore(account: TelegramAccountRef, before: Date, limit: number): Promise<number> {
    const [, affected]: [unknown, number] = await this.repository.query(
      `DELETE FROM telegram_message WHERE ctid = ANY (ARRAY(
         SELECT ctid FROM telegram_message
          WHERE "organizationId" = $1 AND "accountId" = $2 AND "sentAt" < $3
          LIMIT $4))`,
      [account.organizationId, account.accountId, before, limit],
    );
    return affected;
  }

  /** The batch past the newest `keep`, picked by a backward walk of `IDX_telegram_message_account_sent`. */
  async pruneBeyond(account: TelegramAccountRef, keep: number, limit: number): Promise<number> {
    const [, affected]: [unknown, number] = await this.repository.query(
      `DELETE FROM telegram_message WHERE ctid = ANY (ARRAY(
         SELECT ctid FROM telegram_message
          WHERE "organizationId" = $1 AND "accountId" = $2
          ORDER BY "sentAt" DESC
          OFFSET $3 LIMIT $4))`,
      [account.organizationId, account.accountId, keep, limit],
    );
    return affected;
  }

  findChats(account: TelegramAccountRef, limit: number): Promise<TelegramChat[]> {
    return this.chats(account, limit, null);
  }

  async findChat(account: TelegramAccountRef, chatId: string): Promise<Option<TelegramChat>> {
    const [chat] = await this.chats(account, 1, chatId);
    return chat ? Some(chat) : None;
  }

  /** The newest row of each chat (or of one), then the chats by it. */
  private async chats(
    account: TelegramAccountRef,
    limit: number,
    chatId: string | null,
  ): Promise<TelegramChat[]> {
    // One pass over the account's slice of `IDX_telegram_message_account_sent`,
    // or of one chat's rows within it.
    const rows: Array<
      TelegramMessageOrmEntity & {
        messageCount: string;
        lastName: string | null;
        handle: string | null;
      }
    > = await this.repository.query(
      `SELECT * FROM (
           SELECT DISTINCT ON ("chatId") m.*,
                  count(*) OVER (PARTITION BY "chatId") AS "messageCount",
                  (array_agg("chatName") FILTER (WHERE "chatName" IS NOT NULL)
                     OVER (PARTITION BY "chatId" ORDER BY "sentAt" DESC
                           ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING))[1] AS "lastName",
                  (array_agg("senderUsername") FILTER (WHERE "senderUsername" IS NOT NULL
                                                         AND NOT "fromBot"
                                                         AND "senderId" = "chatId")
                     OVER (PARTITION BY "chatId" ORDER BY "sentAt" DESC
                           ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING))[1] AS "handle"
             FROM telegram_message m
            WHERE "organizationId" = $1 AND "accountId" = $2
              AND ($4::varchar IS NULL OR "chatId" = $4)
            ORDER BY "chatId", "sentAt" DESC, id DESC
         ) chats
         ORDER BY "sentAt" DESC
         LIMIT $3`,
      [account.organizationId, account.accountId, limit, chatId],
    );
    return rows.map((row) => ({
      accountId: row.accountId,
      chatId: row.chatId,
      chatKind: row.chatKind,
      chatName: row.lastName ?? row.chatName,
      handle: row.chatKind === 'direct' ? row.handle : null,
      messageCount: Number(row.messageCount),
      last: this.mapper.toDomain(row),
    }));
  }

  async findInChat(
    account: TelegramAccountRef,
    chatId: string,
    limit: number,
    before: Date | null,
  ): Promise<TelegramMessage[]> {
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
    account: TelegramAccountRef,
    query: string,
    limit: number,
  ): Promise<TelegramMessage[]> {
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

  async countBotSendsSince(account: TelegramAccountRef, since: Date): Promise<number> {
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
