/** What one attachment is to a bot: text it can read, an image to show, or neither. */
export type AttachmentReading =
  | { kind: 'text'; format: string; text: string; truncated: boolean }
  | { kind: 'image'; mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' }
  | { kind: 'unreadable'; reason: string };

/**
 * Reads an attachment's bytes as a bot can take them (`product/next-steps/mail.md`
 * §3.2): PDFs, Word, Excel and PowerPoint files, text, CSV and HTML as text;
 * images as images. Nothing is ever run, and archives are never unpacked.
 */
export interface AttachmentReaderPort {
  read(file: { filename: string; mimeType: string; bytes: Buffer }): Promise<AttachmentReading>;
}

/** The most text one attachment hands the bot. */
export const ATTACHMENT_TEXT_MAX = 10_000;
