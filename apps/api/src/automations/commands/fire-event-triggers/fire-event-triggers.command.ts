import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** An external event the hub stored: find the triggers it fires and queue their runs. */
export class FireEventTriggersCommand extends CommandBase {
  readonly organizationId: string;
  readonly inboundEventId: string;
  readonly source: string;
  readonly eventType: string;
  readonly subjectRef: string;
  readonly externalId: string;
  readonly actorIsOwnApp: boolean;
  readonly attributes: Record<string, unknown>;

  constructor(props: CommandProps<FireEventTriggersCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.inboundEventId = props.inboundEventId;
    this.source = props.source;
    this.eventType = props.eventType;
    this.subjectRef = props.subjectRef;
    this.externalId = props.externalId;
    this.actorIsOwnApp = props.actorIsOwnApp;
    this.attributes = props.attributes;
  }
}
