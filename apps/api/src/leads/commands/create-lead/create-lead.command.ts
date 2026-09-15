import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class CreateLeadCommand extends CommandBase {
  readonly organizationId: string;
  readonly teamId?: string | null;
  readonly ownerId?: string | null;
  readonly name: string;
  readonly email?: string | null;
  readonly value?: number;
  readonly notes?: string | null;

  constructor(props: CommandProps<CreateLeadCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.teamId = props.teamId;
    this.ownerId = props.ownerId;
    this.name = props.name;
    this.email = props.email;
    this.value = props.value;
    this.notes = props.notes;
  }
}
