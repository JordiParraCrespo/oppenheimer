import { describe, expect, it } from 'vitest';
import { mailPlanAttachmentSchema } from '../mail.schema.js';

/**
 * A plan's files as a send card stores them (`product/next-steps/mail.md`
 * §3.4): a file stored before files had a `source` still reads, as the file
 * of a message it always was, so a card raised before the change still sends.
 */
describe('mailPlanAttachmentSchema', () => {
  it('reads a stored file without a source as a file of a message', () => {
    expect(
      mailPlanAttachmentSchema.parse({
        messageId: 'm1',
        partId: '2',
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3,
      }),
    ).toMatchObject({ source: 'mail', messageId: 'm1' });
  });

  it('refuses an image from the chat without its attachment id', () => {
    expect(
      mailPlanAttachmentSchema.safeParse({
        source: 'chat',
        filename: 'receipt.png',
        mimeType: 'image/png',
        sizeBytes: 3,
      }).success,
    ).toBe(false);
  });
});
