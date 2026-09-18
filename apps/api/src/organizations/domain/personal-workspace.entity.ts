import { randomUUID } from 'node:crypto';
import {
  type AggregateID,
  AggregateRoot,
  ArgumentNotProvidedException,
} from '@oppenheimer/backend-ddd';
import { PersonalWorkspaceProvisionedDomainEvent } from './events/personal-workspace-provisioned.domain-event';
import { OrganizationSlug } from './value-objects/organization-slug.value-object';

export interface PersonalWorkspaceProps {
  /** What the workspace is called: the account's own name. */
  name: string;
  slug: OrganizationSlug;
  /** The account the workspace belongs to. */
  ownerId: string;
  /** Identity of the membership row that makes the owner a member. */
  membershipId: AggregateID;
  /** The org-scoped `owner` application role the owner is granted. */
  ownerRoleId: string;
}

export interface ProvisionPersonalWorkspaceProps {
  ownerId: string;
  /** The account's email, used to name the workspace when it has no name. */
  ownerEmail: string;
  /** The account's display name, when it has one. */
  ownerName?: string | null;
  /** Id of the system `owner` role, looked up by the handler. */
  ownerRoleId: string;
}

/**
 * The workspace an account works in — one organization, owned by one person.
 *
 * Three rows are one aggregate here because they are one fact. The
 * `organization` says the workspace exists, the `member` row says who owns it,
 * and the org-scoped `owner` role grant is what lets that person actually open
 * it: the app's routes are guarded by CASL, which reads the role, not the
 * membership. A workspace written without the grant is one its owner is
 * refused from — worse than no workspace at all, because the onboarding screen
 * only recovers the *absent* case. So the consistency boundary is all three or
 * none, and the repository writes them in a single transaction.
 *
 * One user per workspace is the MVP's model
 * (`product/versions/mvp/00-scope.md`). Teams and rosters arrive later on the
 * same tables; when they do, the membership this aggregate owns becomes the
 * first of many and the aggregate boundary is worth revisiting.
 */
export class PersonalWorkspaceEntity extends AggregateRoot<PersonalWorkspaceProps> {
  /**
   * Provision the workspace a new account is owed.
   *
   * The workspace is named after the account — its display name, or the local
   * part of its email when it has none, which is what someone signing up with
   * a bare address would call themselves anyway.
   */
  static provisionFor(props: ProvisionPersonalWorkspaceProps): PersonalWorkspaceEntity {
    const displayName = props.ownerName?.trim() || props.ownerEmail.split('@')[0];
    const workspace = new PersonalWorkspaceEntity({
      id: randomUUID(),
      props: {
        name: displayName,
        slug: OrganizationSlug.derive(displayName),
        ownerId: props.ownerId,
        membershipId: randomUUID(),
        ownerRoleId: props.ownerRoleId,
      },
    });

    workspace.addEvent(
      new PersonalWorkspaceProvisionedDomainEvent({
        aggregateId: workspace.id,
        ownerId: workspace.ownerId,
        name: workspace.name,
        slug: workspace.slug.value,
        reason: `${props.ownerEmail} signed up and is owed the workspace their account lives in`,
      }),
    );

    return workspace;
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): OrganizationSlug {
    return this.props.slug;
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get membershipId(): AggregateID {
    return this.props.membershipId;
  }

  get ownerRoleId(): string {
    return this.props.ownerRoleId;
  }

  public validate(): void {
    if (!this.props.name) {
      throw new ArgumentNotProvidedException('A workspace must have a name');
    }
    if (!this.props.ownerId) {
      throw new ArgumentNotProvidedException('A personal workspace must have an owner');
    }
    if (!this.props.ownerRoleId) {
      throw new ArgumentNotProvidedException(
        'A personal workspace must grant its owner the role that opens it',
      );
    }
  }
}
