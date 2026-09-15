import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { Scope } from '@oppenheimer/shared';

/** The principal minting the token, as the guard resolved it. */
export interface ApiTokenActor {
  id: string;
  /** Legacy single-role column, still unioned into the effective ability. */
  role?: string;
  /** Active organization, so org-scoped permission conditions resolve. */
  activeOrganizationId?: string | null;
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
