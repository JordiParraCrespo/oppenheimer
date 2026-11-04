import { createHash } from 'node:crypto';
import { Inject, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import type { WatchedSubject } from '../../../automations/domain/automation-read.types';
import { FindWatchedSubjectsQuery } from '../../../automations/queries/find-watched-subjects/find-watched-subjects.query';
import { ReceiveInboundDeliveryCommand } from '../../../inbound-events/commands/receive-inbound-delivery/receive-inbound-delivery.command';
import { MailWatchResolver } from '../../application/mail-watch.resolver';
import type { GmailConnectionRepositoryPort } from '../../database/gmail-connection.repository.port';
import type { GmailConnectionEntity } from '../../domain/gmail-connection.entity';
import { GMAIL_DELIVERY_EVENT } from '../../infrastructure/gmail-event-normalizer.util';
import { GMAIL_CONNECTION_REPOSITORY } from '../../mail.di-tokens';
import { PollWatchedMailCommand } from './poll-watched-mail.command';

/**
 * Waking on new mail (`product/next-steps/mail.md` §5), the noticing half:
 * once a minute, for each account a live routine watches and only those,
 * read Gmail's history from the stored mark (`users.history.list`, two quota
 * units), run each watched query on what arrived, and hand the messages some
 * trigger takes to the inbound-events hub as one delivery, which stores one
 * event per account and message and fires the triggers. An account a
 * routine starts watching starts from now, and so does one watched again
 * after a pause or a reconnect: the mark of an account the poll does not
 * read is dropped. History Gmail no longer keeps starts again from now. One
 * account failing does not stop the others.
 */
@CommandHandler(PollWatchedMailCommand)
export class PollWatchedMailCommandHandler
  implements ICommandHandler<PollWatchedMailCommand, number>
{
  private readonly logger = new Logger(PollWatchedMailCommandHandler.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly watch: MailWatchResolver,
    @Inject(GMAIL_CONNECTION_REPOSITORY)
    private readonly connections: GmailConnectionRepositoryPort,
  ) {}

  async execute(command: PollWatchedMailCommand): Promise<number> {
    const watched = await this.queryBus.execute<FindWatchedSubjectsQuery, WatchedSubject[]>(
      new FindWatchedSubjectsQuery({ source: 'gmail' }),
    );
    const connections =
      watched.length > 0
        ? await this.connections.findManyForSystem(watched.map((subject) => subject.subjectRef))
        : [];
    const read = connections.flatMap((connection) => {
      const subject = watched.find(
        (each) =>
          each.subjectRef === connection.id && each.organizationId === connection.organizationId,
      );
      return subject ? [{ connection, filters: subject.filters }] : [];
    });
    // A mark this poll does not move goes stale: one kept through a pause, a
    // deleted routine or a revoked grant would hand over that gap's mail as new.
    await this.connections.forgetHistoryExcept(read.map(({ connection }) => connection.id));
    // Each account is its own quota and mark, read side by side; a trigger reads only its workspace's.
    const polled = await Promise.all(
      read.map(async ({ connection, filters }) => {
        try {
          return await this.poll(connection, filters, command.now);
        } catch (error) {
          this.logger.warn({
            message: 'A watched Gmail account could not be read',
            connectionId: connection.id,
            error: error instanceof Error ? error.message : String(error),
          });
          return 0;
        }
      }),
    );
    return polled.reduce((sum, count) => sum + count, 0);
  }

  private async poll(
    connection: GmailConnectionEntity,
    filters: readonly (string | null)[],
    now: Date,
  ): Promise<number> {
    const read = await this.watch.read(connection, filters, now);
    if (read.delivery) {
      await this.commandBus.execute(
        new ReceiveInboundDeliveryCommand({
          source: 'gmail',
          // One read, mark to mark: an overlap is its own delivery; a message still wakes once.
          deliveryId: `${connection.id}:${read.from}:${read.to}`,
          eventName: GMAIL_DELIVERY_EVENT,
          payload: read.delivery,
          payloadDigest: createHash('sha256').update(JSON.stringify(read.delivery)).digest('hex'),
        }),
      );
    }
    // Only from the mark it read: a read that overlapped another moves nothing.
    if (read.to !== read.from) await this.connections.markHistory(connection, read.to);
    return read.delivery?.messages.length ?? 0;
  }
}
