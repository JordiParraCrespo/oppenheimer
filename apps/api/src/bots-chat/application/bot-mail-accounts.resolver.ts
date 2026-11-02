import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { GmailConnectionEntity } from '../../mail/domain/gmail-connection.entity';
import { FindGmailConnectionsQuery } from '../../mail/queries/find-gmail-connections/find-gmail-connections.query';
import { describeAccount, NO_GMAIL } from '../bot-mail-tool.mapper';
import { BotToolRefusal } from './bot-tool.factory';

/**
 * Which of the owner's Gmail accounts a mail tool's call means: by its id,
 * its address or its name, the way the model was shown them. A name that
 * matches none is refused with the accounts listed, so the bot can correct
 * itself.
 */
@Injectable()
export class BotMailAccountsResolver {
  constructor(private readonly queryBus: QueryBus) {}

  async all(owner: AccessScope): Promise<GmailConnectionEntity[]> {
    return this.queryBus.execute<FindGmailConnectionsQuery, GmailConnectionEntity[]>(
      new FindGmailConnectionsQuery({ scope: owner }),
    );
  }

  /** The accounts a call names, or every active one when it names none. */
  async choose(owner: AccessScope, wanted: string | undefined): Promise<GmailConnectionEntity[]> {
    if (wanted) return [await this.one(owner, wanted)];
    const connections = await this.all(owner);
    if (connections.length === 0) throw new BotToolRefusal(NO_GMAIL);
    const active = connections.filter((connection) => connection.isActive);
    if (active.length === 0) {
      throw new BotToolRefusal(
        `Every connected Gmail account needs reconnecting in Settings → Mail: ${connections.map(describeAccount).join('; ')}.`,
      );
    }
    return active;
  }

  /** One account by its id, its address or its name, ignoring case. */
  async one(owner: AccessScope, wanted: string): Promise<GmailConnectionEntity> {
    const connections = await this.all(owner);
    if (connections.length === 0) throw new BotToolRefusal(NO_GMAIL);
    const needle = wanted.trim().toLowerCase();
    const found =
      connections.find((connection) => connection.id === wanted.trim()) ??
      connections.find((connection) => connection.accountEmail.toLowerCase() === needle) ??
      connections.find((connection) => connection.label.toLowerCase() === needle);
    if (!found) {
      throw new BotToolRefusal(
        `No connected Gmail account is "${wanted}". The accounts are: ${connections.map(describeAccount).join('; ')}.`,
      );
    }
    return found;
  }
}
