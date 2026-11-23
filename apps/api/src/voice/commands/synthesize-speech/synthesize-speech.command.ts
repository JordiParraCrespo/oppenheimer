import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** A short text to be spoken as one voice note, for a workspace's bot. */
export class SynthesizeSpeechCommand extends CommandBase {
  readonly organizationId: string;
  readonly text: string;

  constructor(props: CommandProps<SynthesizeSpeechCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.text = props.text;
  }
}

/** The text, spoken: Ogg/Opus, already judged by its bytes, and how long it runs. */
export interface SpokenAudio {
  data: Buffer;
  mimetype: 'audio/ogg; codecs=opus';
  seconds: number;
}
