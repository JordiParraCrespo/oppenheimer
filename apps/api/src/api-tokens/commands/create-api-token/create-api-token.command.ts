import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { Scope } from '@oppenheimer/shared';
import type { MintingCredentialReach } from '../../domain/minting-reach.policy';

/** The principal minting the token, as the guard resolved it. */
export interface ApiTokenActor {
  id: string;
  /** Legacy single-role column, still unioned into the effective ability. */
  role?: string;
  /** Active organization, so org-scoped permission conditions resolve. */
  organizationId?: string | null;
  /** The scoped credential presenting the request, if it is not a browser session. */
  credential?: MintingCredentialReach;
  /**
   * When the credential presenting the request began its chain: the scoped
   * credential's `issuedAt`, or the browser session's creation. The new token
   * inherits it, so it is refused with its minter after a password reset.
   */
  issuedUnder?: Date | null;
}

export class CreateApiTokenCommand extends CommandBase {
  readonly actor: ApiTokenActor;
  readonly name: string;
  readonly scopes: Scope[];
  readonly organizationIds?: string[];
  readonly expiresInDays?: number | null;
  readonly ipAllowlist?: string[];

  constructor(props: CommandProps<CreateApiTokenCommand>) {
    super(props);
    this.actor = props.actor;
    this.name = props.name;
    this.scopes = props.scopes;
    this.organizationIds = props.organizationIds;
    this.expiresInDays = props.expiresInDays;
    this.ipAllowlist = props.ipAllowlist;
  }
}
