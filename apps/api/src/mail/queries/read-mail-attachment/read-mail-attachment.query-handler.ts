import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import type { AttachmentReaderPort } from '../../infrastructure/attachment-reader.port';
import { ATTACHMENT_READER } from '../../mail.di-tokens';
import { type MailAttachmentRead, ReadMailAttachmentQuery } from './read-mail-attachment.query';

/**
 * Fetches an attachment's bytes when, and only when, a bot asks for that one,
 * and reads them (`product/next-steps/mail.md` §3.2). Nothing is kept here.
 */
@QueryHandler(ReadMailAttachmentQuery)
export class ReadMailAttachmentQueryHandler
  implements IQueryHandler<ReadMailAttachmentQuery, MailAttachmentRead>
{
  constructor(
    private readonly gmail: GmailCallResolver,
    @Inject(ATTACHMENT_READER) private readonly reader: AttachmentReaderPort,
  ) {}

  async execute({
    scope,
    connectionId,
    messageId,
    partId,
  }: ReadMailAttachmentQuery): Promise<MailAttachmentRead> {
    const connection = await this.gmail.activeConnection(scope, connectionId);
    const file = await this.gmail.call(connection, (provider, grant) =>
      provider.readAttachment(grant, messageId, { attachmentId: null, partId }),
    );
    return {
      filename: file.filename,
      mimeType: file.mimeType,
      sizeBytes: file.bytes.length,
      reading: await this.reader.read(file),
      bytes: file.bytes,
    };
  }
}
