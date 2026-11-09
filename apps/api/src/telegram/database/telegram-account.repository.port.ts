import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { TelegramAccountEntity } from '../domain/telegram-account.entity';

/**
 * A Telegram bot is a person's: every scoped read is of the caller's own, in their
 * workspace, and a person connects at most `TELEGRAM_ACCOUNTS_MAX`. The host's
 * reports arrive as nobody, so those reads are by host.
 */
export interface TelegramAccountRepositoryPort {
  /** The caller's own Telegram bots, oldest first. */
  findAllOwn(scope: AccessScope): Promise<TelegramAccountEntity[]>;
  /** One of the caller's own; someone else's is none. */
  findOwnById(scope: AccessScope, id: string): Promise<Option<TelegramAccountEntity>>;
  /** The Telegram bot on a host, whoever's: for the host's own reports and messages. */
  findByHostForSystem(hostId: string): Promise<Option<TelegramAccountEntity>>;
  /** A Telegram bot by its id, whoever's: for a reply its owner's bot owes them. */
  findByIdForSystem(organizationId: string, id: string): Promise<Option<TelegramAccountEntity>>;
  insert(account: TelegramAccountEntity): Promise<void>;
  /** Writes the label and the bot's state. */
  save(account: TelegramAccountEntity): Promise<void>;
  delete(account: TelegramAccountEntity): Promise<void>;
  /**
   * Writes the owner the `start` link recorded (`claimOwner`), only while
   * the link it used is still the open one: two `/start` messages racing
   * record one owner. Answers whether this one did.
   */
  saveOwner(account: TelegramAccountEntity, usedCodeHash: string): Promise<boolean>;
}
