import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class CreateCheckoutCommand extends CommandBase {
  readonly userId: string;
  readonly email?: string;
  readonly priceId: string;
  readonly successUrl?: string;
  readonly cancelUrl?: string;

  constructor(props: CommandProps<CreateCheckoutCommand>) {
    super(props);
    this.userId = props.userId;
    this.email = props.email;
    this.priceId = props.priceId;
    this.successUrl = props.successUrl;
    this.cancelUrl = props.cancelUrl;
  }
}
