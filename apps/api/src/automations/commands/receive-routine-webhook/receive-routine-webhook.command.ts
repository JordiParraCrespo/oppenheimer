import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Something was posted to a routine's webhook URL. */
export class ReceiveRoutineWebhookCommand extends CommandBase {
  /** The token in the URL: the only thing that names the routine. */
  readonly token: string;
  /** Exactly the bytes that were sent, which a signature is checked over. */
  readonly body: Buffer;
  readonly contentType: string | undefined;
  /** `x-oppenheimer-signature`, when the sender signed. */
  readonly signature: string | undefined;
  /** The sender's `Idempotency-Key`: a retried POST is the same run. */
  readonly idempotencyKey: string | undefined;

  constructor(props: CommandProps<ReceiveRoutineWebhookCommand>) {
    super(props);
    this.token = props.token;
    this.body = props.body;
    this.contentType = props.contentType;
    this.signature = props.signature;
    this.idempotencyKey = props.idempotencyKey;
  }
}
