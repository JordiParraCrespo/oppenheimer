import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class MintPairingTokenCommand extends CommandBase {
  readonly userId: string;
  readonly name: string;
  /** Where the request came from, recorded so a stranger's mint is visible (F5). */
  readonly createdFromIp: string | null;

  constructor(props: CommandProps<MintPairingTokenCommand>) {
    super(props);
    this.userId = props.userId;
    this.name = props.name;
    this.createdFromIp = props.createdFromIp;
  }
}
