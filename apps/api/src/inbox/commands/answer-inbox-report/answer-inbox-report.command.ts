import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class AnswerInboxReportCommand extends CommandBase {
  /** The request's workspace; null when it acts in none. */
  readonly organizationId: string | null;
  readonly userId: string;
  readonly reportId: string;
  readonly text: string;

  constructor(props: CommandProps<AnswerInboxReportCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.reportId = props.reportId;
    this.text = props.text;
  }
}
