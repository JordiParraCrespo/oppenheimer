import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class HandleGithubWebhookCommand extends CommandBase {
  /** The raw request body, exactly as received — the bytes GitHub signed. */
  readonly payload: Buffer | string;
  /** The `x-hub-signature-256` header value. */
  readonly signature: string;
  /** The `x-github-event` header value. */
  readonly event: string;
  /** The `x-github-delivery` header value: GitHub's id for this delivery, its idempotency key. */
  readonly deliveryId: string;

  constructor(props: CommandProps<HandleGithubWebhookCommand>) {
    super(props);
    this.payload = props.payload;
    this.signature = props.signature;
    this.event = props.event;
    this.deliveryId = props.deliveryId;
  }
}
