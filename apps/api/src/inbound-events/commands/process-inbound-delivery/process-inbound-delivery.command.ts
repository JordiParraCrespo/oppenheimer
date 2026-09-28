import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Normalize a stored delivery into events and publish them. Run by the hub's worker. */
export class ProcessInboundDeliveryCommand extends CommandBase {
  readonly inboundDeliveryId: string;

  constructor(props: CommandProps<ProcessInboundDeliveryCommand>) {
    super(props);
    this.inboundDeliveryId = props.inboundDeliveryId;
  }
}
