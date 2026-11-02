import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { AttachmentReading } from '../../infrastructure/attachment-reader.port';

/** The bytes of one attachment of one message in one of the caller's Gmail accounts. */
export class ReadMailAttachmentQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly connectionId: string;
  readonly messageId: string;
  /** The MIME part the attachment sits in, as a message lists it. */
  readonly partId: string;

  constructor(props: {
    scope: AccessScope;
    connectionId: string;
    messageId: string;
    partId: string;
  }) {
    super();
    this.scope = props.scope;
    this.connectionId = props.connectionId;
    this.messageId = props.messageId;
    this.partId = props.partId;
  }
}

/** An attachment as a bot takes it: what it read, and the bytes an image is shown from. */
export interface MailAttachmentRead {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  reading: AttachmentReading;
  bytes: Buffer;
}
