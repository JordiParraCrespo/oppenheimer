import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * A machine redeeming its registration token. There is no caller identity on
 * this command: the token is the credential, and the owner of the host is
 * whoever minted it.
 */
export class RegisterHostCommand extends CommandBase {
  /** The registration token secret, as the install command pasted it. */
  readonly token: string;
  /** The name the runner detected, used only when the token named nothing. */
  readonly name: string;
  /** Base64 of the machine's raw Ed25519 public key. */
  readonly publicKey: string;
  /** The machine inventory, stored as it arrived. */
  readonly facts: unknown;
  /** Where the redemption came from, recorded beside where it was minted (F5). */
  readonly redeemedFromIp: string | null;

  constructor(props: CommandProps<RegisterHostCommand>) {
    super(props);
    this.token = props.token;
    this.name = props.name;
    this.publicKey = props.publicKey;
    this.facts = props.facts;
    this.redeemedFromIp = props.redeemedFromIp;
  }
}
