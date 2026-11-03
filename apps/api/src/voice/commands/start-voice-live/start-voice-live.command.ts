import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class StartVoiceLiveCommand extends CommandBase {
  readonly organizationId: string | null;
  /** The names the console shows, one per line, for the model to expect. */
  readonly vocabulary: string | undefined;
  readonly language: string | undefined;

  constructor(props: CommandProps<StartVoiceLiveCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.vocabulary = props.vocabulary;
    this.language = props.language;
  }
}
