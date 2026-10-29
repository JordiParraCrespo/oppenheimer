import { Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { MailPlan, MailPlanAttachment } from '@oppenheimer/shared';
import type { GmailConnectionEntity } from '../domain/gmail-connection.entity';
import { MailErrors } from '../domain/mail.errors';
import { addressesOf, isMailAddress, type MailAddress } from '../domain/mail-address.policy';
import { replyRecipients } from '../domain/mail-reply.policy';
import { type MailRequest, recipientsRefusal, sizeRefusal } from '../domain/mail-send.policy';
import { buildMime } from '../infrastructure/gmail-mime.util';
import type {
  GmailCallGrant,
  GmailMessage,
  GmailProviderPort,
  GmailRawMessage,
  GmailSendAs,
} from '../infrastructure/gmail-provider.port';
import { MailPlanMapper } from '../mail-plan.mapper';
import { GmailCallResolver } from './gmail-call.resolver';

/**
 * Turns what a bot asks to write into a {@link MailPlan}, every default
 * resolved against the account (`product/next-steps/mail.md` §3.3–3.4), and
 * a plan into the message Gmail is handed. A plan is what a send card shows
 * and what a yes sends: the message is built from it and nothing else.
 */
@Injectable()
export class MailComposeResolver {
  constructor(private readonly gmail: GmailCallResolver) {}

  async plan(connection: GmailConnectionEntity, request: MailRequest): Promise<MailPlan> {
    return this.gmail.call(connection, async (provider, grant) => {
      const aliases = await provider.listSendAs(grant);
      const from = senderOf(aliases, request.from, connection.accountEmail);
      const original = request.messageId
        ? await provider.readMessage(grant, request.messageId)
        : null;
      if (request.kind !== 'new' && !original) {
        throw new AppError(MailErrors.GMAIL_ITEM_NOT_FOUND, {
          detail: 'An answer or a forward names the message it answers',
        });
      }
      const own = [connection.accountEmail, ...aliases.map((alias) => alias.email)];
      const given = {
        to: parsedRecipients(request.to),
        cc: parsedRecipients(request.cc),
        bcc: parsedRecipients(request.bcc),
      };
      const answering = request.kind === 'reply' || request.kind === 'reply_all';
      const answered =
        answering && original
          ? replyRecipients(original, own, request.kind === 'reply_all')
          : { to: [], cc: [] };
      const to = [...answered.to, ...given.to];
      const cc = [...answered.cc, ...given.cc];
      const refusal = recipientsRefusal(to.length + cc.length + given.bcc.length);
      if (refusal) throw new AppError(MailErrors.RECIPIENTS_REFUSED, { detail: refusal });

      const attachments = [
        ...(original && request.kind === 'forward' ? MailPlanMapper.attachmentsOf(original) : []),
        ...(await this.namedAttachments(provider, grant, request.attachments)),
      ];
      const tooLarge = sizeRefusal(
        attachments.reduce((sum, file) => sum + file.sizeBytes, 0),
        Buffer.byteLength(request.body, 'utf8'),
      );
      if (tooLarge) throw new AppError(MailErrors.MESSAGE_TOO_LARGE, { detail: tooLarge });

      return MailPlanMapper.toPlan({
        request,
        connection,
        from,
        original,
        to,
        cc,
        bcc: given.bcc,
        recipientsFromMail: Boolean(answering && answered.to.length + answered.cc.length > 0),
        attachments,
      });
    });
  }

  /** A saved draft as it stands, for a card that sends it unchanged. */
  async planDraft(connection: GmailConnectionEntity, draftId: string): Promise<MailPlan> {
    return this.gmail.call(connection, async (provider, grant) => {
      const draft = await provider.readDraft(grant, draftId);
      const plan = MailPlanMapper.draftToPlan(connection, draft);
      // A draft written in Gmail is held to the same limit as one a bot writes.
      const refusal = recipientsRefusal(plan.to.length + plan.cc.length + plan.bcc.length);
      if (refusal) throw new AppError(MailErrors.RECIPIENTS_REFUSED, { detail: refusal });
      return plan;
    });
  }

  /**
   * The message Gmail is handed for a plan: the body with the answered or
   * forwarded message quoted and the alias's signature, the threading, and
   * every file's bytes, fetched now.
   */
  async build(
    provider: GmailProviderPort,
    grant: GmailCallGrant,
    plan: MailPlan,
  ): Promise<GmailRawMessage> {
    const original = plan.original
      ? await provider.readMessage(grant, plan.original.messageId)
      : null;
    const signatureHtml = plan.signature
      ? ((await provider.listSendAs(grant)).find(
          (alias) => alias.email.toLowerCase() === plan.from.email.toLowerCase(),
        )?.signatureHtml ?? null)
      : null;
    const files = await Promise.all(
      plan.attachments.map(async (file) => {
        const content = await provider.readAttachment(grant, file.messageId, {
          attachmentId: null,
          partId: file.partId,
        });
        return { filename: file.filename, mimeType: file.mimeType, bytes: content.bytes };
      }),
    );
    const raw = buildMime(MailPlanMapper.toOutgoing(plan, original, signatureHtml, files));
    return { raw, threadId: plan.threadId };
  }

  /** Files named by message and part, with what their messages say they are. */
  private async namedAttachments(
    provider: GmailProviderPort,
    grant: GmailCallGrant,
    named: MailRequest['attachments'],
  ): Promise<MailPlanAttachment[]> {
    const messages = new Map<string, GmailMessage>();
    const found: MailPlanAttachment[] = [];
    for (const { messageId, partId } of named) {
      let message = messages.get(messageId);
      if (!message) {
        message = await provider.readMessage(grant, messageId);
        messages.set(messageId, message);
      }
      const file = MailPlanMapper.attachmentsOf(message).find(
        (attachment) => attachment.partId === partId,
      );
      if (!file) {
        throw new AppError(MailErrors.GMAIL_ITEM_NOT_FOUND, {
          detail: `Message ${messageId} has no attachment in part ${partId}`,
        });
      }
      found.push(file);
    }
    return found;
  }
}

/** The alias asked for, or the account's default; an address it does not send from is refused. */
function senderOf(
  aliases: readonly GmailSendAs[],
  wanted: string | null,
  accountEmail: string,
): MailPlan['from'] {
  const chosen = wanted
    ? aliases.find((alias) => alias.email.toLowerCase() === wanted.trim().toLowerCase())
    : (aliases.find((alias) => alias.isDefault) ?? aliases[0]);
  if (wanted && !chosen) {
    throw new AppError(MailErrors.ALIAS_NOT_FOUND, {
      detail: `${wanted} is not ${accountEmail} or one of its send-as addresses`,
    });
  }
  return chosen
    ? { email: chosen.email, name: chosen.displayName }
    : { email: accountEmail, name: null };
}

/** Recipients as given: each one an address, with or without a name. */
function parsedRecipients(given: readonly string[]): MailAddress[] {
  return given.flatMap((entry) => {
    const parsed = addressesOf(entry);
    if (parsed.length === 0 || !parsed.every((address) => isMailAddress(address.email))) {
      throw new AppError(MailErrors.RECIPIENTS_REFUSED, {
        detail: `"${entry}" is not an email address`,
      });
    }
    return parsed;
  });
}
