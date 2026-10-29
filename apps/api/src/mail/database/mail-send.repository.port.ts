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
  /** Sends from one account since a moment, counting those still going out; failed ones do not count. */
  countSince(connectionId: string, since: Date): Promise<number>;
  /** The caller's own sends, newest first, at most `limit`. */
  findRecentOwn(scope: AccessScope, limit: number): Promise<MailSendEntity[]>;
}
