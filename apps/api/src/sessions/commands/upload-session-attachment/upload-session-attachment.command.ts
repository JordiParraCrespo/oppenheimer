import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { SessionFileHint } from '@oppenheimer/shared/protocol';

export class UploadSessionAttachmentCommand extends CommandBase {
  readonly organizationId: string | null;
  readonly userId: string;
  /** Absent when the request carried no file part. */
  readonly data: Buffer | undefined;
  /** What the browser said the file is, label and name. Read only to pick a text type. */
  readonly hint: SessionFileHint;

  constructor(props: CommandProps<UploadSessionAttachmentCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.data = props.data;
    this.hint = props.hint;
  }
}
