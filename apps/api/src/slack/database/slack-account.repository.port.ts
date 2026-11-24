import type { AccessScope } from '@oppenheimer/backend-authz';
import type { DomainEvent } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type { SlackAccountEntity } from '../domain/slack-account.entity';

/**
 * A Slack app is its bot's maker's: every scoped read is of the caller's own,
 * in their workspace. Slack's events arrive as nobody, so those reads are by
 * the bot the events address.
 */
export interface SlackAccountRepositoryPort {
  /** The caller's own Slack apps, oldest first. */
  findAllOwn(scope: AccessScope): Promise<SlackAccountEntity[]>;
  /** One of the caller's own; someone else's is none. */
  findOwnById(scope: AccessScope, id: string): Promise<Option<SlackAccountEntity>>;
  /** The caller's own app for one of their bots. */
  findOwnByBot(scope: AccessScope, botId: string): Promise<Option<SlackAccountEntity>>;
  /** A bot's app, whoever's: for the events Slack sends it. */
  findByBotForSystem(botId: string): Promise<Option<SlackAccountEntity>>;
  /** An app by its id, whoever's: for the answer its owner's bot owes them. */
  findByIdForSystem(organizationId: string, id: string): Promise<Option<SlackAccountEntity>>;
  /** Inserts a new app, or writes new credentials over the bot's one. Answers `taken` when the Slack app is another bot's. */
  put(account: SlackAccountEntity): Promise<'saved' | 'taken'>;
  /** Writes the status alone (a token Slack refused). */
  saveStatus(account: SlackAccountEntity): Promise<void>;
  /** Writes the open `link` code, and nothing else. */
  saveOwnerLink(account: SlackAccountEntity): Promise<void>;
  /**
   * Writes the owner a `link` code recorded, only while the code it used is
   * still the open one: two racing record one owner. Answers whether this one did.
   */
  saveOwner(account: SlackAccountEntity, usedCodeHash: string): Promise<boolean>;
  /** Stages the events in a transaction of their own: what an event from Slack owes. */
  publish(events: readonly DomainEvent[]): Promise<void>;
  delete(account: SlackAccountEntity): Promise<void>;
}
