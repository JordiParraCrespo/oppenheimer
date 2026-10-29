import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { GmailConnectionEntity } from '../domain/gmail-connection.entity';

/**
 * A connection is a person's: every read is of the caller's own, in their
 * workspace. A person holds at most five, so a list of them is bounded.
 */
export interface GmailConnectionRepositoryPort {
  /** The caller's own accounts, oldest first. */
  findAllOwn(scope: AccessScope): Promise<GmailConnectionEntity[]>;
  /** One of the caller's own; someone else's is none. */
  findOwnById(scope: AccessScope, id: string): Promise<Option<GmailConnectionEntity>>;
  insert(connection: GmailConnectionEntity): Promise<void>;
  /** Writes a reconnect or a rename: the grant, the account, the label and the status. */
  save(connection: GmailConnectionEntity): Promise<void>;
  /**
   * Moves the poll's history mark, only from the mark the connection was read
   * with: a poll that overlapped another and lost answers false and moves
   * nothing. Nothing else on the row is written.
   */
  markHistory(connection: GmailConnectionEntity, historyId: string): Promise<boolean>;
  /** The active connections with these ids, whoever's: for the poll, which runs as nobody. */
  findManyForSystem(ids: readonly string[]): Promise<GmailConnectionEntity[]>;
  markRevoked(connection: GmailConnectionEntity): Promise<void>;
  delete(connection: GmailConnectionEntity): Promise<void>;
}
