import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class UploadSessionAttachmentCommand extends CommandBase {
  readonly organizationId: string | null;
  readonly userId: string;
  /** Absent when the request carried no file part. */
  readonly data: Buffer | undefined;

  constructor(props: CommandProps<UploadSessionAttachmentCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.data = props.data;
  }
}
