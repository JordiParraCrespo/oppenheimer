import { Injectable } from '@nestjs/common';
import type { GmailConnectionEntity } from '../domain/gmail-connection.entity';
import { takenMessages, watchedQuery } from '../domain/mail-watch.policy';
import {
  type GmailDeliveryPayload,
  toGmailDelivery,
} from '../infrastructure/gmail-event-normalizer.util';
import { GmailCallResolver } from './gmail-call.resolver';

/** The most new messages one account's read takes; the rest wait for the next minute. */
const NEW_MAIL_PER_READ = 50;

/** One read of a watched mailbox: the mark it read from, the mark to move to, and what it took. */
export interface MailWatchRead {
  /** Null for an account read for the first time. */
  from: string | null;
  to: string;
  /** The new messages some trigger takes; null when none does. */
  delivery: GmailDeliveryPayload | null;
}

/**
 * Reads what arrived in one watched Gmail account since its mark
 * (`product/next-steps/mail.md` §5): `users.history.list` from the stored
 * `historyId`, each watched query run as a Gmail search crossed with what
 * arrived, and the envelopes of what some trigger takes. An account read for
 * the first time, or whose history Gmail no longer keeps, starts from now
 * and takes nothing. Writes nothing: the caller delivers and moves the mark.
 */
@Injectable()
export class MailWatchResolver {
  constructor(private readonly gmail: GmailCallResolver) {}

  read(
    connection: GmailConnectionEntity,
    filters: readonly (string | null)[],
  ): Promise<MailWatchRead> {
    return this.gmail.call(connection, async (provider, grant) => {
      const from = connection.historyId;
      const mail = from ? await provider.newMessages(grant, from, NEW_MAIL_PER_READ) : null;
      if (!mail) return { from, to: await provider.currentHistoryId(grant), delivery: null };
      const queries = mail.messageIds.length > 0 ? filters.filter((f) => f !== null) : [];
      const matches = new Map(
        await Promise.all(
          queries.map(async (query) => {
            const ids = await provider.matchingIds(grant, watchedQuery(query), mail.messageIds);
            return [query, ids] as const;
          }),
        ),
      );
      const taken = takenMessages(mail.messageIds, filters, matches);
      const summaries = await provider.readSummaries(
        grant,
        taken.map(({ id }) => id),
      );
      return {
        from,
        to: mail.historyId,
        delivery: summaries.length > 0 ? toGmailDelivery(connection, summaries, taken) : null,
      };
    });
  }
}
