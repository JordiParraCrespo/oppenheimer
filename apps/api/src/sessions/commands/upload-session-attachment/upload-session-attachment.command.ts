import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class UploadSessionAttachmentCommand extends CommandBase {
  readonly organizationId: string | null;
  readonly userId: string;
  readonly data: Buffer;

  constructor(props: CommandProps<UploadSessionAttachmentCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.data = props.data;
  }
}
