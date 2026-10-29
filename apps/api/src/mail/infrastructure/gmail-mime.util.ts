import { randomBytes } from 'node:crypto';
import { formatAddress, type MailAddress } from '../domain/mail-address.policy';
import type { MailBody } from './mail-body.util';

/** A message as it is handed to Gmail: who, what, its threading and its files. */
export interface OutgoingMail {
  from: MailAddress;
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  subject: string;
  body: MailBody;
  inReplyTo: string | null;
  references: string | null;
  attachments: { filename: string; mimeType: string; bytes: Buffer }[];
}

/**
 * The RFC 2822 message Gmail's API takes as `raw`: the text and HTML as
 * `multipart/alternative`, inside `multipart/mixed` when there are files.
 * Non-ASCII headers are RFC 2047 words, bodies and files base64 at 76
 * columns, so nothing depends on the server's line handling. Gmail adds the
 * `Date` and `Message-ID`.
 */
export function buildMime(mail: OutgoingMail): Buffer {
  const headers = [
    `From: ${encodeAddress(mail.from)}`,
    ...(mail.to.length ? [`To: ${mail.to.map(encodeAddress).join(', ')}`] : []),
    ...(mail.cc.length ? [`Cc: ${mail.cc.map(encodeAddress).join(', ')}`] : []),
    ...(mail.bcc.length ? [`Bcc: ${mail.bcc.map(encodeAddress).join(', ')}`] : []),
    `Subject: ${encodeWord(mail.subject)}`,
    ...(mail.inReplyTo ? [`In-Reply-To: ${oneLine(mail.inReplyTo)}`] : []),
    ...(mail.references ? [`References: ${oneLine(mail.references)}`] : []),
    'MIME-Version: 1.0',
  ];
  const alternative = boundary();
  const bodyPart = [
    `Content-Type: multipart/alternative; boundary="${alternative}"`,
    '',
    `--${alternative}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(Buffer.from(mail.body.text, 'utf8')),
    `--${alternative}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(Buffer.from(mail.body.html, 'utf8')),
    `--${alternative}--`,
  ].join('\r\n');
  if (mail.attachments.length === 0) {
    return Buffer.from(`${headers.join('\r\n')}\r\n${bodyPart}\r\n`, 'utf8');
  }
  const mixed = boundary();
  const files = mail.attachments.map((file) =>
    [
      `--${mixed}`,
      `Content-Type: ${safeType(file.mimeType)}; name="${asciiName(file.filename)}"`,
      `Content-Disposition: attachment; filename="${asciiName(file.filename)}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      'Content-Transfer-Encoding: base64',
      '',
      base64Lines(file.bytes),
    ].join('\r\n'),
  );
  return Buffer.from(
    [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${mixed}"`,
      '',
      `--${mixed}`,
      bodyPart,
      ...files,
      `--${mixed}--`,
      '',
    ].join('\r\n'),
    'utf8',
  );
}

/** A header value read from another message: never a line break, so never a header of its own. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function boundary(): string {
  return `=_oppenheimer_${randomBytes(12).toString('hex')}`;
}

function base64Lines(bytes: Buffer): string {
  return (bytes.toString('base64').match(/.{1,76}/g) ?? ['']).join('\r\n');
}

/** A header value as an RFC 2047 word when it is not plain ASCII; line breaks never survive. */
function encodeWord(value: string): string {
  const clean = value.replace(/[\r\n]+/g, ' ');
  // biome-ignore lint/suspicious/noControlCharactersInRegex: printable ASCII is exactly what passes
  return /^[\x20-\x7e]*$/.test(clean)
    ? clean
    : `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
}

function encodeAddress(address: MailAddress): string {
  if (!address.name) return address.email;
  const name = address.name.replace(/[\r\n]+/g, ' ');
  // biome-ignore lint/suspicious/noControlCharactersInRegex: printable ASCII is exactly what passes
  return /^[\x20-\x7e]*$/.test(name)
    ? formatAddress({ name, email: address.email })
    : `${encodeWord(name)} <${address.email}>`;
}

function asciiName(filename: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: printable ASCII is exactly what passes
  return filename.replace(/[^\x20-\x7e]|["\\\r\n]/g, '_') || 'attachment';
}

/** A file's type as a header: one `type/subtype`, never a value that could add a header. */
function safeType(mimeType: string): string {
  return /^[\w.+-]+\/[\w.+-]+$/.test(mimeType) ? mimeType : 'application/octet-stream';
}
