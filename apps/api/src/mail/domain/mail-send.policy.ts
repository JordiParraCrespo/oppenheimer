import {
  MAIL_MESSAGE_MAX_BYTES,
  MAIL_RECIPIENTS_MAX,
  MAIL_SENDS_PER_DAY,
} from '@oppenheimer/shared';

/**
 * How much a bot may send (`product/next-steps/mail.md` §3.4), on top of
 * Gmail's own limits: so a loop can never send in bulk from a person's
 * address. Each answers why not, or null.
 */
export function recipientsRefusal(count: number): string | null {
  if (count === 0) return 'A message needs at least one recipient';
  return count > MAIL_RECIPIENTS_MAX
    ? `${count} recipients; a bot sends to at most ${MAIL_RECIPIENTS_MAX} at once`
    : null;
}

/** Sends in the last day from one account, against the daily cap. */
export function dailyRefusal(sentInLastDay: number): string | null {
  return sentInLastDay >= MAIL_SENDS_PER_DAY
    ? `${sentInLastDay} messages sent from this account in the last 24 hours; the limit is ${MAIL_SENDS_PER_DAY}`
    : null;
}

/** The message's files against Gmail's 25 MB; base64 makes each a third larger on the wire. */
export function sizeRefusal(attachmentBytes: number, bodyBytes: number): string | null {
  const total = Math.ceil((attachmentBytes * 4) / 3) + bodyBytes;
  return total > MAIL_MESSAGE_MAX_BYTES
    ? `About ${Math.round(total / 1024 / 1024)} MB with its files; Gmail takes 25 MB at most`
    : null;
}

/** The window the daily cap counts over. */
export function dayBefore(now: Date): Date {
  return new Date(now.getTime() - 24 * 60 * 60 * 1000);
}

/** What a bot asks to write: a new message, an answer, or a forward. */
export interface MailRequest {
  kind: 'new' | 'reply' | 'reply_all' | 'forward';
  /** The message answered or forwarded. */
  messageId: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  /** Null keeps the answered message's subject, with `Re:` or `Fwd:`. */
  subject: string | null;
  body: string;
  /** An address the account sends from; null for its default. */
  from: string | null;
  signature: boolean;
  /** Files from messages in the account, beside a forward's own. */
  attachments: { messageId: string; partId: string }[];
}
