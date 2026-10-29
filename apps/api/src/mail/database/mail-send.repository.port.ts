import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { MailSendEntity } from '../domain/mail-send.entity';

export interface MailSendRepositoryPort {
  /** The send an approval carried out, or started to; an approval id is unique. */
  findByApproval(approvalId: string): Promise<Option<MailSendEntity>>;
  /** Writes the claim, unless the approval already has one: whether this claim won. */
  claim(send: MailSendEntity): Promise<boolean>;
  /** Writes how the send ended: sent with Gmail's ids, or failed. */
  save(send: MailSendEntity): Promise<void>;
  /**
   * Sends from one account that went since a moment, by when they went,
   * counting those still going out; failed, waiting and cancelled ones do not count.
   */
  countSince(connectionId: string, since: Date): Promise<number>;
  /** Scheduled sends whose time has come, oldest first, at most `limit`; every workspace's. */
  findDue(now: Date, limit: number): Promise<MailSendEntity[]>;
  /**
   * Moves a due send from waiting to going, only if it still waits: whether
   * this claim won. A cancel or another replica's claim makes it lose.
   */
  claimDue(send: MailSendEntity): Promise<boolean>;
  /** Stops one of the caller's scheduled sends, only while it still waits: whether it did. */
  cancelOwn(scope: AccessScope, id: string): Promise<boolean>;
  /** The caller's scheduled sends still waiting, soonest first, at most `limit`. */
  findScheduledOwn(scope: AccessScope, limit: number): Promise<MailSendEntity[]>;
  /** The caller's own sends, newest first, at most `limit`. */
  findRecentOwn(scope: AccessScope, limit: number): Promise<MailSendEntity[]>;
}
