import { createHash } from 'node:crypto';
import { Inject, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import type { WatchedSubject } from '../../../automations/domain/automation-read.types';
import { FindWatchedSubjectsQuery } from '../../../automations/queries/find-watched-subjects/find-watched-subjects.query';
import { ReceiveInboundDeliveryCommand } from '../../../inbound-events/commands/receive-inbound-delivery/receive-inbound-delivery.command';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import type { GmailConnectionRepositoryPort } from '../../database/gmail-connection.repository.port';
import type { GmailConnectionEntity } from '../../domain/gmail-connection.entity';
import { takenMessages, watchedQuery } from '../../domain/mail-watch.policy';
import {
  GMAIL_DELIVERY_EVENT,
  toGmailDelivery,
} from '../../infrastructure/gmail-event-normalizer.util';
import { GMAIL_CONNECTION_REPOSITORY } from '../../mail.di-tokens';
import { PollWatchedMailCommand } from './poll-watched-mail.command';

/** The most new messages one account's poll reads; the rest wait for the next minute. */
const NEW_MAIL_PER_POLL = 50;
/** How many ids a watched query is asked for; the new mail of one minute is far fewer. */
const QUERY_IDS = 100;

/**
 * Waking on new mail (`product/next-steps/mail.md` §5), the noticing half:
 * once a minute, for each account a live routine watches and only those,
 * read Gmail's history from the stored mark (`users.history.list`, two quota
 * units), run each watched query on what arrived, and hand the messages some
 * trigger takes to the inbound-events hub as one delivery, which stores one
 * event per account and message and fires the triggers. An account a
 * routine starts watching starts from now; history Gmail no longer keeps
 * starts again from now. One account failing does not stop the others.
 */
@CommandHandler(PollWatchedMailCommand)
export class PollWatchedMailCommandHandler
  implements ICommandHandler<PollWatchedMailCommand, number>
{
  private readonly logger = new Logger(PollWatchedMailCommandHandler.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly gmail: GmailCallResolver,
    @Inject(GMAIL_CONNECTION_REPOSITORY)
    private readonly connections: GmailConnectionRepositoryPort,
  ) {}

  async execute(_command: PollWatchedMailCommand): Promise<number> {
    const watched = await this.queryBus.execute<FindWatchedSubjectsQuery, WatchedSubject[]>(
      new FindWatchedSubjectsQuery({ source: 'gmail' }),
    );
    if (watched.length === 0) return 0;
    const connections = await this.connections.findManyForSystem(
      watched.map((subject) => subject.subjectRef),
    );
    let delivered = 0;
    for (const connection of connections) {
      // A trigger in one workspace never reads an account of another.
      const subject = watched.find(
        (candidate) =>
          candidate.subjectRef === connection.id &&
          candidate.organizationId === connection.organizationId,
      );
      if (!subject) continue;
      try {
        delivered += await this.poll(connection, subject.filters);
      } catch (error) {
        this.logger.warn({
          message: 'A watched Gmail account could not be read',
          connectionId: connection.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return delivered;
  }

  private poll(
    connection: GmailConnectionEntity,
    filters: readonly (string | null)[],
  ): Promise<number> {
    return this.gmail.call(connection, async (provider, grant) => {
      const start = connection.historyId;
      if (!start) {
        await this.connections.markHistory(connection, await provider.currentHistoryId(grant));
        return 0;
      }
      const mail = await provider.newMessages(grant, start, NEW_MAIL_PER_POLL);
      if (!mail) {
        await this.connections.markHistory(connection, await provider.currentHistoryId(grant));
        return 0;
      }
      const queries = filters.filter((filter): filter is string => filter !== null);
      const matches = new Map<string, readonly string[]>();
      if (mail.messageIds.length > 0) {
        for (const query of queries) {
          matches.set(query, await provider.searchIds(grant, watchedQuery(query), QUERY_IDS));
        }
      }
      const taken = takenMessages(mail.messageIds, filters, matches);
      const ids = taken.map(({ id }) => id);
      const summaries = await provider.readSummaries(grant, ids);
      if (summaries.length > 0) {
        const payload = toGmailDelivery(connection, summaries, taken);
        await this.commandBus.execute(
          new ReceiveInboundDeliveryCommand({
            source: 'gmail',
            // The same mark read twice is the same delivery, stored once.
            deliveryId: `${connection.id}:${start}`,
            eventName: GMAIL_DELIVERY_EVENT,
            payload,
            payloadDigest: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
          }),
        );
      }
      if (mail.historyId !== start) await this.connections.markHistory(connection, mail.historyId);
      return summaries.length;
    });
  }
}
