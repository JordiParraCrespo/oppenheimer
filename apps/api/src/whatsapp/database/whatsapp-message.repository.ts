import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { type EntityManager, Repository } from 'typeorm';
import type {
  WhatsappChat,
  WhatsappChatPlace,
  WhatsappMessage,
  WhatsappMessageDraft,
  WhatsappStoredMessage,
} from '../domain/whatsapp-message.types';
import { WhatsappMessageMapper } from '../whatsapp-message.mapper';
import { WhatsappMessageOrmEntity } from './whatsapp-message.orm-entity';
import type {
  WhatsappAccountRef,
  WhatsappMessageRepositoryPort,
  WhatsappMessagesOwed,
} from './whatsapp-message.repository.port';

@Injectable()
export class WhatsappMessageRepository implements WhatsappMessageRepositoryPort {
  constructor(
    @InjectRepository(WhatsappMessageOrmEntity)
    private readonly repository: Repository<WhatsappMessageOrmEntity>,
    private readonly mapper: WhatsappMessageMapper,
    private readonly outbox: OutboxService,
  ) {}

  async insertMany(
    messages: readonly WhatsappMessageDraft[],
    owed?: WhatsappMessagesOwed,
  ): Promise<WhatsappStoredMessage[]> {
    if (messages.length === 0) return [];
    return this.outbox.transaction(async (manager) => {
      // UQ_whatsapp_message_external: what is already kept is skipped, and keeps its seq.
      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(WhatsappMessageOrmEntity)
        .values(messages.map((message) => this.mapper.toPersistence(message)))
        .orIgnore()
        .returning(['id', 'seq', 'chatId', 'externalId'])
        .execute();
      const rows = new Map(
        (result.raw as { id: string; seq: string; chatId: string; externalId: string }[]).map(
          (row) => [`${row.chatId}/${row.externalId}`, row],
        ),
      );
      const inserted = messages.flatMap((message) => {
        const row = rows.get(`${message.chatId}/${message.externalId}`);
        return row ? [{ message, row }] : [];
      });
      const owners = owed
        ? inserted.filter(({ message }) => owed.isOwners(message)).map(({ row }) => row)
        : [];
      const places = owed ? await placesWithin(manager, owners, messages[0], owed) : new Map();
      const stored = inserted.map(({ message, row }) =>
        this.mapper.toStored(message, row, places.get(row.id) ?? null),
      );
      const events = stored.flatMap((message) => {
        const event = message.place ? owed?.eventFor(message, message.place) : null;
        return event ? [event] : [];
      });
      if (events.length > 0) await this.outbox.stageEvents(manager, events);
      return stored;
    });
  }

  async recordBotSend(message: WhatsappMessageDraft): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(WhatsappMessageOrmEntity)
      .values(this.mapper.toPersistence(message))
      .orUpdate(
        ['sentByBotId', 'isReply', 'quotedId'],
        ['organizationId', 'accountId', 'chatId', 'externalId'],
      )
      .execute();
  }

  async findById(account: WhatsappAccountRef, id: string): Promise<WhatsappMessage | null> {
    const record = await this.repository.findOneBy({
      id,
      organizationId: account.organizationId,
      accountId: account.accountId,
    });
    return record ? this.mapper.toDomain(record) : null;
  }

  async findSwitchedBot(account: WhatsappAccountRef, chatId: string): Promise<string | null> {
    // IDX_whatsapp_message_switch, walked backward from the chat's last row.
    const rows: { switchesToBotId: string }[] = await this.repository.query(
      `SELECT "switchesToBotId" FROM whatsapp_message
        WHERE "organizationId" = $1 AND "accountId" = $2 AND "chatId" = $3
          AND "switchesToBotId" IS NOT NULL
        ORDER BY seq DESC
        LIMIT 1`,
      [account.organizationId, account.accountId, chatId],
    );
    return rows[0]?.switchesToBotId ?? null;
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

  /** The batch past the newest `keep`, picked by a backward walk of `IDX_whatsapp_message_account_sent`. */
  async pruneBeyond(account: WhatsappAccountRef, keep: number, limit: number): Promise<number> {
    const [, affected]: [unknown, number] = await this.repository.query(
      `DELETE FROM whatsapp_message WHERE ctid = ANY (ARRAY(
         SELECT ctid FROM whatsapp_message
          WHERE "organizationId" = $1 AND "accountId" = $2
          ORDER BY "sentAt" DESC
          OFFSET $3 LIMIT $4))`,
      [account.organizationId, account.accountId, keep, limit],
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
      .andWhere('NOT message.isReply')
      .getCount();
  }
}

/** The owner's `/new`, as `IDX_whatsapp_message_new` holds it (its predicate, on `n`). */
const WHATSAPP_NEW_COMMAND_SQL = `NOT n."fromMe" AND n.text ~* '^\\s*/new\\s*$'`;

/**
 * For each of the owner's new messages, by row id, its place in its chat:
 * the bot of the last switch at or before its seq (else the default), and
 * the later of where that bot took the chat over and the owner's last
 * `/new`. A switch that names the bot already answering ("Shop: …" while
 * Shop answers) takes nothing over, so the bot took the chat at the first of
 * the switches to it since one to another bot, and never when it is the
 * default and no other bot was switched to. The batch is already in, so a
 * switch or `/new` earlier in the same batch counts.
 */
async function placesWithin(
  manager: EntityManager,
  owners: readonly { id: string; seq: string; chatId: string }[],
  first: WhatsappMessageDraft | undefined,
  owed: WhatsappMessagesOwed,
): Promise<Map<string, WhatsappChatPlace>> {
  if (!first || owners.length === 0) return new Map();
  // IDX_whatsapp_message_switch and IDX_whatsapp_message_new, once per
  // message: the last switch (sw), the last one before it to another bot
  // (other), the first of the run between them (took), and the last /new.
  // Only the owner's direct chat is placed, and every message there that is
  // not the number's own is the owner's, whichever form WhatsApp wrote their
  // number in (Brazil, Mexico), so the /new is found by its chat alone.
  const rows: { id: string; switchBotId: string | null; startsAt: string }[] = await manager.query(
    `SELECT m.id,
              sw."switchesToBotId" AS "switchBotId",
              GREATEST(CASE
                WHEN sw.seq IS NULL THEN 0
                WHEN other.seq IS NULL AND sw."switchesToBotId" = $6::uuid THEN 0
                ELSE took.seq
              END, COALESCE((
                SELECT n.seq FROM whatsapp_message n
                 WHERE n."organizationId" = $1 AND n."accountId" = $2 AND n."chatId" = m.chat
                   AND ${WHATSAPP_NEW_COMMAND_SQL} AND n.seq <= m.seq
                 ORDER BY n.seq DESC LIMIT 1
              ), 0))::text AS "startsAt"
         FROM unnest($3::uuid[], $4::text[], $5::bigint[]) AS m(id, chat, seq)
         LEFT JOIN LATERAL (
           SELECT s.seq, s."switchesToBotId" FROM whatsapp_message s
            WHERE s."organizationId" = $1 AND s."accountId" = $2 AND s."chatId" = m.chat
              AND s."switchesToBotId" IS NOT NULL AND s.seq <= m.seq
            ORDER BY s.seq DESC LIMIT 1
         ) sw ON true
         LEFT JOIN LATERAL (
           SELECT p.seq FROM whatsapp_message p
            WHERE p."organizationId" = $1 AND p."accountId" = $2 AND p."chatId" = m.chat
              AND p."switchesToBotId" IS NOT NULL AND p.seq < sw.seq
              AND p."switchesToBotId" <> sw."switchesToBotId"
            ORDER BY p.seq DESC LIMIT 1
         ) other ON true
         LEFT JOIN LATERAL (
           SELECT r.seq FROM whatsapp_message r
            WHERE r."organizationId" = $1 AND r."accountId" = $2 AND r."chatId" = m.chat
              AND r."switchesToBotId" IS NOT NULL
              AND r.seq > COALESCE(other.seq, 0) AND r.seq <= sw.seq
            ORDER BY r.seq ASC LIMIT 1
         ) took ON true`,
    [
      first.organizationId,
      first.accountId,
      owners.map((owner) => owner.id),
      owners.map((owner) => owner.chatId),
      owners.map((owner) => owner.seq),
      owed.answeringBotId,
    ],
  );
  return new Map(
    rows.map((row) => [
      row.id,
      { botId: row.switchBotId ?? owed.answeringBotId, startsAt: row.startsAt },
    ]),
  );
}

/** `%`, `_` and the escape itself, taken literally in an `ILIKE`. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
