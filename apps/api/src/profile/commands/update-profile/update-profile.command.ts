import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * A partial update of the caller's own profile. `undefined` leaves a field
 * alone; an explicit `null` clears `phone` / `jobTitle`.
 *
 * Note what is absent: email, role and active state. Email moves only through
 * a verified request (`ChangeEmailCommand`); role and active state belong to
 * the admin surface on `/users`. A field the command lacks cannot be reached,
 * rather than being filtered out somewhere downstream.
 */
export class UpdateProfileCommand extends CommandBase {
  readonly userId: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string | null;
  readonly jobTitle?: string | null;
  readonly username?: string | null;

  constructor(props: CommandProps<UpdateProfileCommand>) {
    super(props);
    this.userId = props.userId;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.phone = props.phone;
    this.jobTitle = props.jobTitle;
    this.username = props.username;
  }
}
