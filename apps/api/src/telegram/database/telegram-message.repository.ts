import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { type EntityManager, Repository } from 'typeorm';
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
  TelegramMessagesOwed,
} from './telegram-message.repository.port';

@Injectable()
export class TelegramMessageRepository implements TelegramMessageRepositoryPort {
  constructor(
    @InjectRepository(TelegramMessageOrmEntity)
    private readonly repository: Repository<TelegramMessageOrmEntity>,
    private readonly mapper: TelegramMessageMapper,
    private readonly outbox: OutboxService,
  ) {}

  async insertMany(
    messages: readonly TelegramMessageDraft[],
    owed?: TelegramMessagesOwed,
  ): Promise<TelegramMessageDraft[]> {
    if (messages.length === 0) return [];
    return this.outbox.transaction(async (manager) => {
      // UQ_telegram_message_external: what is already kept is skipped.
      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(TelegramMessageOrmEntity)
        .values(messages.map((message) => this.mapper.toPersistence(message)))
        .orIgnore()
        .returning(['chatId', 'externalId'])
        .execute();
      const stored = new Set(
        (result.raw as { chatId: string; externalId: string }[]).map(
          (row) => `${row.chatId}/${row.externalId}`,
        ),
      );
      const inserted = messages.filter((message) =>
        stored.has(`${message.chatId}/${message.externalId}`),
      );
      const owing = inserted.flatMap((message) => {
        const event = owed?.eventFor(message);
        return event ? [{ message, event }] : [];
      });
      const starts = await lastNewWithin(
        manager,
        owing.map(({ message }) => message),
        owed?.ownerTelegramId ?? null,
      );
      const events = owing.flatMap(({ message, event }) => {
        const built = event(starts.get(`${message.chatId}/${message.externalId}`) ?? '0');
        return built ? [built] : [];
      });
      if (events.length > 0) await this.outbox.stageEvents(manager, events);
      return inserted;
    });
  }

  async wroteInChatSince(
    account: TelegramAccountRef,
    chatId: string,
    since: Date,
  ): Promise<boolean> {
    // IDX_telegram_message_chat.
    const rows: unknown[] = await this.repository.query(
      `SELECT 1 FROM telegram_message
        WHERE "organizationId" = $1 AND "accountId" = $2 AND "chatId" = $3
          AND "fromBot" AND "sentAt" >= $4
        LIMIT 1`,
      [account.organizationId, account.accountId, chatId, since],
    );
    return rows.length > 0;
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

/**
 * Whether a stored message is a `/new`, as `telegramInboundAction` reads one
 * (an optional `@bot` and one word after it): the partial index
 * `IDX_telegram_message_new` holds only these, so the predicate is written
 * exactly as its `WHERE`.
 */
const TELEGRAM_NEW_COMMAND_SQL = `text ~* '^\\s*/new(@\\w+)?(\\s+\\S+)?\\s*$'`;

/**
 * For each message, keyed `chat/id`, the id of the owner's last `/new` in
 * its chat at or before it, the whole batch included since it is stored in
 * this transaction; '0' for none. Telegram numbers a chat's messages in
 * order, so this is the same whatever order the batch's events are later
 * delivered in. One query for the batch.
 */
async function lastNewWithin(
  manager: EntityManager,
  messages: readonly TelegramMessageDraft[],
  ownerTelegramId: string | null,
): Promise<Map<string, string>> {
  if (!ownerTelegramId || messages.length === 0) return new Map();
  const [first] = messages;
  // IDX_telegram_message_new, once per message: the /new rows are a handful.
  const rows: { key: string; startsAt: string }[] = await manager.query(
    `SELECT m.chat || '/' || m.ext AS key,
            COALESCE((
              SELECT MAX(n."externalId"::bigint) FROM telegram_message n
               WHERE n."organizationId" = $1 AND n."accountId" = $2 AND n."chatId" = m.chat
                 AND ${TELEGRAM_NEW_COMMAND_SQL.replace('text', 'n.text')}
                 AND n."senderId" = $3 AND n."externalId"::bigint <= m.ext::bigint
            ), 0)::text AS "startsAt"
       FROM unnest($4::text[], $5::text[]) AS m(chat, ext)`,
    [
      first.organizationId,
      first.accountId,
      ownerTelegramId,
      messages.map((message) => message.chatId),
      messages.map((message) => message.externalId),
    ],
  );
  return new Map(rows.map((row) => [row.key, row.startsAt]));
}
