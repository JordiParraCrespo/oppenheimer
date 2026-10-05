import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * A verified delivery from a provider's own endpoint. The provider module has
 * already authenticated it; the hub stores it and owes it processing.
 */
export class ReceiveInboundDeliveryCommand extends CommandBase {
  readonly source: string;
  /** The provider's delivery id (`X-GitHub-Delivery`): its idempotency key. */
  readonly deliveryId: string;
  /** The provider's event name (`X-GitHub-Event`). */
  readonly eventName: string;
  readonly payload: Record<string, unknown>;
  /**
   * SHA-256 hex of the **raw bytes** the provider signed, not of `payload`.
   * The delivery id is an unsigned header, so the same signed bytes under
   * another id are a replay, and this is what recognises one.
   */
  readonly payloadDigest: string;

  constructor(props: CommandProps<ReceiveInboundDeliveryCommand>) {
    super(props);
    this.source = props.source;
    this.deliveryId = props.deliveryId;
    this.eventName = props.eventName;
    this.payload = props.payload;
    this.payloadDigest = props.payloadDigest;
  }
}
