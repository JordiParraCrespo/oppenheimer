import { addressesOf, type MailAddress, uniqueAddresses } from './mail-address.policy';

/** What a reply or a forward needs of the message it answers. */
export interface AnsweredMessage {
  from: string;
  to: string;
  cc: string;
  replyTo: string;
  subject: string;
  /** Its `Message-ID`, which the answer's `In-Reply-To` names. */
  messageIdHeader: string;
  /** Its `References`, which the answer's carries on. */
  referencesHeader: string;
}

/** "Re: Invoice 42", once: a subject that already says so keeps its own. */
export function replySubject(subject: string): string {
  const trimmed = subject.trim();
  return /^re\s*:/i.test(trimmed) ? trimmed : `Re: ${trimmed || '(no subject)'}`;
}

/** "Fwd: Invoice 42", once. */
export function forwardSubject(subject: string): string {
  const trimmed = subject.trim();
  return /^(fwd?|fw)\s*:/i.test(trimmed) ? trimmed : `Fwd: ${trimmed || '(no subject)'}`;
}

/**
 * Who an answer goes to, as a mail client decides it: a reply goes to the
 * `Reply-To` when the message set one, else to its sender; a reply-all adds
 * everyone it was sent and copied to. The person's own addresses (every
 * alias) are never among them, and nobody is listed twice.
 */
export function replyRecipients(
  message: AnsweredMessage,
  ownAddresses: readonly string[],
  all: boolean,
): { to: MailAddress[]; cc: MailAddress[] } {
  const own = new Set(ownAddresses.map((address) => address.toLowerCase()));
  const notOwn = (address: MailAddress) => !own.has(address.email.toLowerCase());
  const answered = addressesOf(message.replyTo || message.from);
  const sender = answered.filter(notOwn);
  // Answering your own message goes back to whom it was sent.
  const to = sender.length > 0 ? sender : all ? [] : addressesOf(message.to).filter(notOwn);
  if (!all) return { to: uniqueAddresses(to), cc: [] };
  const everyone = uniqueAddresses([
    ...to,
    ...addressesOf(message.to).filter(notOwn),
    ...addressesOf(message.cc).filter(notOwn),
  ]);
  const toKeys = new Set(to.map((address) => address.email.toLowerCase()));
  return {
    to: everyone.filter((address) => toKeys.has(address.email.toLowerCase())),
    cc: everyone.filter((address) => !toKeys.has(address.email.toLowerCase())),
  };
}

/** The `References` an answer carries: the answered message's, then its own id. */
export function referencesFor(message: AnsweredMessage): string {
  return [message.referencesHeader.trim(), message.messageIdHeader.trim()]
    .filter(Boolean)
    .join(' ');
}
