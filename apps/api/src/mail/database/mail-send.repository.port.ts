import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { MailSendEntity } from '../domain/mail-send.entity';

export type MailSendClaimOutcome =
  | { outcome: 'claimed' }
  | { outcome: 'taken' }
  | { outcome: 'over_cap'; sentInWindow: number };

export interface MailSendRepositoryPort {
  /** The send an approval carried out, or started to; an approval id is unique. */
  findByApproval(approvalId: string): Promise<Option<MailSendEntity>>;
  /** Writes the claim, unless the approval already has one: whether this claim won. */
  claim(send: MailSendEntity): Promise<boolean>;
  /**
   * Claims a send only while its account has sent fewer than `cap` since
   * `since`, the count and the claim one step under a lock on the account, so
   * two sends approved at once cannot both take the last place. `taken`: the
   * approval already has a claim; `over_cap`: the account is at its cap.
   */
  claimUnderCap(send: MailSendEntity, since: Date, cap: number): Promise<MailSendClaimOutcome>;
  /** Writes how the send ended: sent with Gmail's ids, or failed. */
  save(send: MailSendEntity): Promise<void>;
  /** Sends from one account since a moment, counting those still going out; failed ones do not count. */
  countSince(connectionId: string, since: Date): Promise<number>;
  /** The caller's own sends, newest first, at most `limit`. */
  findRecentOwn(scope: AccessScope, limit: number): Promise<MailSendEntity[]>;
}
