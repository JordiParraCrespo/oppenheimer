import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** A picture as it arrived: its bytes, and the name it was sent under. */
export interface PostedInboxReportFile {
  data: Buffer;
  name: string;
}

export class PostInboxReportCommand extends CommandBase {
  /** The request's workspace; null when it acts in none. */
  readonly organizationId: string | null;
  readonly userId: string;
  readonly title: string;
  readonly body: string;
  readonly source: string;
  readonly link: string | null;
  readonly images: PostedInboxReportFile[];

  constructor(props: CommandProps<PostInboxReportCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.title = props.title;
    this.body = props.body;
    this.source = props.source;
    this.link = props.link;
    this.images = props.images;
  }
}
