import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';

/**
 * A number is a person's: every scoped read is of the caller's own, in their
 * workspace, and a person links at most `WHATSAPP_ACCOUNTS_MAX`. The host's
 * reports arrive as nobody, so those reads are by host.
 */
export interface WhatsappAccountRepositoryPort {
  /** The caller's own numbers, oldest first. */
  findAllOwn(scope: AccessScope): Promise<WhatsappAccountEntity[]>;
  /** One of the caller's own; someone else's is none. */
  findOwnById(scope: AccessScope, id: string): Promise<Option<WhatsappAccountEntity>>;
  /** The number on a host, whoever's: for the host's own reports and messages. */
  findByHostForSystem(hostId: string): Promise<Option<WhatsappAccountEntity>>;
  /** A number by its id, whoever's: for a reply its owner's bot owes them. */
  findByIdForSystem(organizationId: string, id: string): Promise<Option<WhatsappAccountEntity>>;
  insert(account: WhatsappAccountEntity): Promise<void>;
  /**
   * Writes the label and the device's state, and the owner's forgetting when
   * a report of another paired number forgot them. Never the default bot,
   * the owner or the waiting code, which each have their own write, so a copy
   * loaded before one of them changed does not put it back.
   */
  save(account: WhatsappAccountEntity): Promise<void>;
  /** Writes which Oppenheimer bot answers here by default, and nothing else. */
  saveAnswering(account: WhatsappAccountEntity): Promise<void>;
  /**
   * Writes the waiting code (`nameOwner`, or its forgetting), and nothing
   * else; with `whileCodeHash`, only while that code is still the one waiting,
   * so forgetting a code whose send failed never drops a newer one.
   */
  saveOwnerCode(account: WhatsappAccountEntity, whileCodeHash?: string): Promise<void>;
  /**
   * Writes what entering a code came to (`confirmOwner`: the owner, or one
   * more wrong try), only while the code it was checked against is still the
   * waiting one and not locked: two entries racing, or an entry racing a new
   * code, change one thing. A wrong try is counted in the row, so tries made
   * at once all count. Answers whether this write landed.
   */
  saveOwner(account: WhatsappAccountEntity, usedCodeHash: string): Promise<boolean>;
  delete(account: WhatsappAccountEntity): Promise<void>;
}
