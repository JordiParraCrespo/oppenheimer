import type {
  GmailAccount,
  GmailAttachmentInfo,
  GmailDraft,
  GmailLabel,
  GmailMessage,
  GmailMessageSummary,
  GmailSendAs,
} from './gmail-provider.port';

/**
 * Gmail's JSON (`users.messages`, `users.threads`, `users.labels`,
 * `users.drafts`) read into the port's shapes. Every reader takes `unknown`
 * and narrows once: Gmail is a system we do not run, and a field it leaves
 * out is an empty value here, never a crash.
 */

/** The longest body one message keeps; a thread of long mails still fits a tool's answer. */
export const GMAIL_BODY_MAX = 8_000;

export function accountOfIdToken(idToken: unknown): GmailAccount | null {
  if (typeof idToken !== 'string') return null;
  const [, payload] = idToken.split('.');
  if (!payload) return null;
  try {
    const claims = record(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    const { sub, email } = claims;
    return typeof sub === 'string' && sub && typeof email === 'string' && email
      ? { subject: sub, email }
      : null;
  } catch {
    return null;
  }
}

/** A message read with `format=full` (or `fields` that keep the part tree), without its body. */
export function messageSummaryOf(input: unknown): GmailMessageSummary {
  const message = record(input);
  const payload = record(message.payload);
  const headers = headersOf(payload);
  const internalDate = Number(text(message.internalDate));
  return {
    id: text(message.id),
    threadId: text(message.threadId),
    from: headers.get('from') ?? '',
    to: headers.get('to') ?? '',
    cc: headers.get('cc') ?? '',
    subject: headers.get('subject') ?? '',
    date: internalDate > 0 ? new Date(internalDate) : null,
    snippet: decodeEntities(text(message.snippet)),
    labelIds: list(message.labelIds).map(text).filter(Boolean),
    attachments: attachmentsOf(payload),
  };
}

/**
 * A message read with `format=full`: its envelope and its text, cut at
 * `bodyMax` for a model to read; a message being answered, forwarded or sent
 * as a draft is read whole (`Infinity`), so nothing it carries is lost.
 */
export function messageOf(input: unknown, bodyMax = GMAIL_BODY_MAX): GmailMessage {
  const message = record(input);
  const payload = record(message.payload);
  const headers = headersOf(payload);
  return {
    ...messageSummaryOf(message),
    bcc: headers.get('bcc') ?? '',
    replyTo: headers.get('reply-to') ?? '',
    messageIdHeader: headers.get('message-id') ?? '',
    referencesHeader: headers.get('references') ?? '',
    dateHeader: headers.get('date') ?? '',
    body: bodyOf(payload, bodyMax),
  };
}

export function labelOf(input: unknown): GmailLabel {
  const label = record(input);
  return {
    id: text(label.id),
    name: text(label.name),
    type: label.type === 'system' ? 'system' : 'user',
    messagesTotal: count(label.messagesTotal),
    messagesUnread: count(label.messagesUnread),
    threadsUnread: count(label.threadsUnread),
  };
}

export function sendAsOf(input: unknown): GmailSendAs {
  const alias = record(input);
  return {
    email: text(alias.sendAsEmail),
    displayName: text(alias.displayName) || null,
    signatureHtml: text(alias.signature),
    isDefault: alias.isDefault === true,
  };
}

/** What Gmail answers a send or a draft write with: the message, its thread, and the draft. */
export function sentRefOf(input: unknown): { messageId: string; threadId: string } {
  const message = record(input);
  return { messageId: text(message.id), threadId: text(message.threadId) };
}

export function draftOf(input: unknown): GmailDraft {
  const draft = record(input);
  return { id: text(draft.id), message: messageSummaryOf(draft.message) };
}

/** The MIME part with this id, anywhere in the tree; none when the message has no such part. */
export function partOf(payload: unknown, partId: string): Record<string, unknown> | null {
  const part = record(payload);
  if (text(part.partId) === partId) return part;
  for (const child of list(part.parts)) {
    const found = partOf(child, partId);
    if (found) return found;
  }
  return null;
}

/** A part's inline bytes (`body.data`, base64url), when Gmail sent them with the message. */
export function inlineBytesOf(part: Record<string, unknown>): Buffer | null {
  const data = record(part.body).data;
  return typeof data === 'string' ? Buffer.from(data, 'base64url') : null;
}

/** Every part that is a file: it has a name, whether its bytes came inline or wait behind an id. */
function attachmentsOf(payload: Record<string, unknown>): GmailAttachmentInfo[] {
  const found: GmailAttachmentInfo[] = [];
  const walk = (input: unknown): void => {
    const part = record(input);
    const filename = text(part.filename);
    const body = record(part.body);
    if (filename) {
      found.push({
        attachmentId: typeof body.attachmentId === 'string' ? body.attachmentId : null,
        partId: text(part.partId),
        filename,
        mimeType: text(part.mimeType) || 'application/octet-stream',
        sizeBytes: count(body.size) ?? 0,
      });
    }
    for (const child of list(part.parts)) walk(child);
  };
  walk(payload);
  return found;
}

/**
 * The text the sender wrote: the first `text/plain` part that is not a file,
 * else the first `text/html` part read as text. Decoded in the part's own
 * charset, cut at `max` with the cut said.
 */
function bodyOf(payload: Record<string, unknown>, max: number): string {
  const plain = firstPart(payload, 'text/plain');
  const html = plain ? null : firstPart(payload, 'text/html');
  const part = plain ?? html;
  if (!part) return '';
  const bytes = inlineBytesOf(part);
  if (!bytes) return '';
  const decoded = decode(bytes, charsetOf(part));
  const body = (html ? htmlToText(decoded) : decoded).replace(/\r\n/g, '\n').trim();
  return body.length > max
    ? `${body.slice(0, max)}\n… (the rest of this message, ${body.length - max} characters, was cut)`
    : body;
}

function firstPart(input: unknown, mimeType: string): Record<string, unknown> | null {
  const part = record(input);
  if (text(part.mimeType).toLowerCase() === mimeType && !text(part.filename)) return part;
  for (const child of list(part.parts)) {
    const found = firstPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

function charsetOf(part: Record<string, unknown>): string {
  const type = headersOf(part).get('content-type') ?? '';
  const match = /charset\s*=\s*"?([^";\s]+)/i.exec(type);
  return match ? match[1].toLowerCase() : 'utf-8';
}

function decode(bytes: Buffer, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return bytes.toString('utf8');
  }
}

/** Header names lower-cased; the first of a repeated header wins, as mail clients read it. */
function headersOf(part: Record<string, unknown>): Map<string, string> {
  const headers = new Map<string, string>();
  for (const entry of list(part.headers)) {
    const header = record(entry);
    const name = text(header.name).toLowerCase();
    if (name && !headers.has(name)) headers.set(name, text(header.value));
  }
  return headers;
}

/** The readable text of an HTML mail: styles, scripts and tags dropped, block breaks kept. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|head|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/table|\/blockquote)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const point = Number.parseInt(code, 16);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    })
    .replace(/&amp;/g, '&');
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function count(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && value !== null && value !== undefined ? number : null;
}
