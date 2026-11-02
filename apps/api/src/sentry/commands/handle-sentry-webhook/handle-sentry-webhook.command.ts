import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class HandleSentryWebhookCommand extends CommandBase {
  /** The connection the URL names. */
  readonly connectionId: string;
  /** The exact bytes Sentry signed. */
  readonly payload: Buffer;
  /** `Sentry-Hook-Signature`. */
  readonly signature: string;
  /** `Sentry-Hook-Resource`: `issue`, `event_alert`, `installation`, … */
  readonly resource: string;
  /** `Request-ID`: Sentry's id for this delivery; empty when it sent none. */
  readonly requestId: string;

  constructor(props: CommandProps<HandleSentryWebhookCommand>) {
    super(props);
    this.connectionId = props.connectionId;
    this.payload = props.payload;
    this.signature = props.signature;
    this.resource = props.resource;
    this.requestId = props.requestId;
  }
}
