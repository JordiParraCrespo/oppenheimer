import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Deleting the caller's own account. `confirmation` is what they typed into
 * the dialog, which has to be their email address.
 */
export class DeleteAccountCommand extends CommandBase {
  readonly userId: string;
  readonly confirmation: string;

  constructor(props: CommandProps<DeleteAccountCommand>) {
    super(props);
    this.userId = props.userId;
    this.confirmation = props.confirmation;
  }
}
