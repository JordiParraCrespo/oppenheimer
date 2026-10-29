import { MAIL_PLAN_BODY_MAX, type MailPlan, type MailPlanAttachment } from '@oppenheimer/shared';
import type { GmailConnectionEntity } from './domain/gmail-connection.entity';
import { addressesOf, formatAddress, type MailAddress } from './domain/mail-address.policy';
import { forwardSubject, referencesFor, replySubject } from './domain/mail-reply.policy';
import type { MailRequest } from './domain/mail-send.policy';
import type { OutgoingMail } from './infrastructure/gmail-mime.util';
import type { GmailDraftRead, GmailMessage } from './infrastructure/gmail-provider.port';
import { composeBody } from './infrastructure/mail-body.util';

/** Where a draft too long for its card is cut. */
const DRAFT_CUT_NOTE = '\n\n[…the rest of the draft is not shown here; it is sent whole]';

/** What a plan is made of once the account, the answered message and the recipients are resolved. */
export interface PlanParts {
  request: MailRequest;
  connection: GmailConnectionEntity;
  from: MailPlan['from'];
  original: GmailMessage | null;
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  /** Whether any recipient was read out of the answered message rather than given. */
  recipientsFromMail: boolean;
  attachments: MailPlanAttachment[];
}

/**
 * The shapes a message takes on its way out (`product/next-steps/mail.md`
 * §3.3–3.4), pure: a plan from what the resolver fetched and checked, a plan
 * from a saved draft, and the outgoing message a plan is built into. Fetching
 * and refusing are the resolver's.
 */
export class MailPlanMapper {
  static toPlan(parts: PlanParts): MailPlan {
    const { request, connection, original } = parts;
    const answering = Boolean(original) && isAnswer(request.kind);
    return {
      kind: request.kind,
      connectionId: connection.id,
      accountEmail: connection.accountEmail,
      from: parts.from,
      to: parts.to.map(formatAddress),
      cc: parts.cc.map(formatAddress),
      bcc: parts.bcc.map(formatAddress),
      recipientsFromMail: parts.recipientsFromMail,
      subject: request.subject?.trim() || subjectFor(request.kind, original),
      body: request.body,
      signature: request.signature,
      original: original
        ? {
            messageId: original.id,
            from: original.from,
            subject: original.subject,
            date: original.dateHeader || null,
          }
        : null,
      threadId: answering && original ? original.threadId : null,
      attachments: parts.attachments,
      draftId: null,
      draftMessageId: null,
    };
  }

  /** A saved draft as it stands: every recipient it carries, Bcc included, and its own files. */
  static draftToPlan(connection: GmailConnectionEntity, draft: GmailDraftRead): MailPlan {
    const message = draft.message;
    const sender = addressesOf(message.from)[0] ?? { name: null, email: connection.accountEmail };
    return {
      kind: 'draft',
      connectionId: connection.id,
      accountEmail: connection.accountEmail,
      from: { email: sender.email, name: sender.name },
      to: addressesOf(message.to).map(formatAddress),
      cc: addressesOf(message.cc).map(formatAddress),
      bcc: addressesOf(message.bcc).map(formatAddress),
      recipientsFromMail: false,
      subject: message.subject,
      // The card shows the draft; Gmail sends the draft it has, whole.
      body:
        message.body.length > MAIL_PLAN_BODY_MAX
          ? `${message.body.slice(0, MAIL_PLAN_BODY_MAX - DRAFT_CUT_NOTE.length)}${DRAFT_CUT_NOTE}`
          : message.body,
      signature: false,
      original: null,
      threadId: message.threadId || null,
      attachments: MailPlanMapper.attachmentsOf(message),
      draftId: draft.id,
      draftMessageId: message.id,
    };
  }

  /** A message's files, as a plan carries them. */
  static attachmentsOf(message: GmailMessage): Extract<MailPlanAttachment, { source: 'mail' }>[] {
    return message.attachments.map((file) => ({
      source: 'mail' as const,
      messageId: message.id,
      partId: file.partId,
      filename: file.filename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    }));
  }

  /**
   * What Gmail is handed for a plan: the body with the answered or forwarded
   * message quoted and the alias's signature, and an answer's threading.
   */
  static toOutgoing(
    plan: MailPlan,
    original: GmailMessage | null,
    signatureHtml: string | null,
    files: OutgoingMail['attachments'],
  ): OutgoingMail {
    const answering = original && isAnswer(plan.kind);
    const quoted =
      original && plan.kind !== 'new'
        ? {
            kind: plan.kind === 'forward' ? ('forward' as const) : ('reply' as const),
            from: original.from,
            to: original.to,
            cc: original.cc,
            subject: original.subject,
            date: original.dateHeader,
            body: original.body,
          }
        : null;
    return {
      from: plan.from,
      to: plan.to.flatMap(addressesOf),
      cc: plan.cc.flatMap(addressesOf),
      bcc: plan.bcc.flatMap(addressesOf),
      subject: plan.subject,
      body: composeBody(plan.body, { quoted, signatureHtml }),
      inReplyTo: answering ? original.messageIdHeader || null : null,
      references: answering ? referencesFor(original) || null : null,
      attachments: files,
    };
  }
}

function isAnswer(kind: MailPlan['kind']): boolean {
  return kind === 'reply' || kind === 'reply_all';
}

/** "Re:" or "Fwd:" on the answered message's subject; a new message without one says so. */
function subjectFor(kind: MailPlan['kind'], original: GmailMessage | null): string {
  if (!original) return '(no subject)';
  return kind === 'forward' ? forwardSubject(original.subject) : replySubject(original.subject);
}
