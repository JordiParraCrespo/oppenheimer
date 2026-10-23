import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class TranscribeVoiceCommand extends CommandBase {
  readonly organizationId: string | null;
  /** Absent when the request carried no `audio` part. */
  readonly audio: Buffer | undefined;
  /** The names the console shows, one per line, for the polish to spell as written. */
  readonly vocabulary: string | undefined;
  readonly language: string | undefined;

  constructor(props: CommandProps<TranscribeVoiceCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.audio = props.audio;
    this.vocabulary = props.vocabulary;
    this.language = props.language;
  }
}
