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
  insert(account: WhatsappAccountEntity): Promise<void>;
  /** Writes the label and the device's state. */
  save(account: WhatsappAccountEntity): Promise<void>;
  delete(account: WhatsappAccountEntity): Promise<void>;
}
