import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ProcessInboundDeliveryCommand extends CommandBase {
  readonly inboundDeliveryId: string;

  constructor(props: CommandProps<ProcessInboundDeliveryCommand>) {
    super(props);
    this.inboundDeliveryId = props.inboundDeliveryId;
  }
}
