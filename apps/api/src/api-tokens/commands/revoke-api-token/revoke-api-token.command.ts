import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RevokeApiTokenCommand extends CommandBase {
  readonly tokenId: string;
  /** The caller. A token may only be revoked by the user who owns it. */
  readonly userId: string;

  constructor(props: CommandProps<RevokeApiTokenCommand>) {
    super(props);
    this.tokenId = props.tokenId;
    this.userId = props.userId;
  }
}
