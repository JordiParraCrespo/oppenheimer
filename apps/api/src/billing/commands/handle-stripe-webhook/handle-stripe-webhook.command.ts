import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class HandleStripeWebhookCommand extends CommandBase {
  /** The raw request body, exactly as received (needed for signature checks). */
  readonly payload: Buffer | string;
  /** The `stripe-signature` header value. */
  readonly signature: string;

  constructor(props: CommandProps<HandleStripeWebhookCommand>) {
    super(props);
    this.payload = props.payload;
    this.signature = props.signature;
  }
}
