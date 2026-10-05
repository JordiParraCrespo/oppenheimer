import { randomUUID } from 'node:crypto';
import {
  type AggregateID,
  AggregateRoot,
  ArgumentNotProvidedException,
} from '@oppenheimer/backend-ddd';
import { PersonalWorkspaceProvisionedDomainEvent } from './events/personal-workspace-provisioned.domain-event';
import { OrganizationSlug } from './value-objects/organization-slug.value-object';

export interface PersonalWorkspaceProps {
  name: string;
  slug: OrganizationSlug;
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
  ownerName?: string | null;
  /** Id of the system `owner` role, looked up by the handler. */
  ownerRoleId: string;
}

/**
 * The workspace an account works in: one organization, owned by one person.
 *
 * Three rows are one fact: the `organization`, the owner's `member` row, and
 * the org-scoped `owner` role grant that lets them open it (CASL reads the
 * role, not the membership). A workspace without the grant refuses its owner,
 * which is worse than none because onboarding only recovers the absent case;
 * so the repository writes all three in one transaction.
 *
 * One user per workspace is the MVP's model
 * (`product/versions/mvp/00-scope.md`); when teams arrive on the same tables,
 * this membership becomes the first of many and the boundary is worth
 * revisiting.
 */
export class PersonalWorkspaceEntity extends AggregateRoot<PersonalWorkspaceProps> {
  /**
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
