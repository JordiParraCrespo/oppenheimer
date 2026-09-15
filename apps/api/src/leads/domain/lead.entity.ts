import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { LeadCreatedDomainEvent } from './events/lead-created.domain-event';

export interface LeadProps {
  /** Tenant the lead belongs to. Immutable — a lead never moves organization. */
  organizationId: string;
  /** Owning team (workspace), or `null` before it is assigned to one. */
  teamId: string | null;
  /** Owning user, or `null` when the lead is unclaimed. */
  ownerId: string | null;
  name: string;
  email: string | null;
  /** Deal value in minor units, so no floating point reaches the money. */
  value: number;
  notes: string | null;
}

export interface CreateLeadProps {
  organizationId: string;
  teamId?: string | null;
  ownerId?: string | null;
  name: string;
  email?: string | null;
  value?: number;
  notes?: string | null;
}

/**
 * Lead aggregate root.
 *
 * The three scope columns are ordinary state here — the domain knows nothing
 * about authorization. Which leads a caller may see is decided outside, by the
 * scope the repository applies; the aggregate's job is only to stay valid.
 */
export class LeadEntity extends AggregateRoot<LeadProps> {
  /** Rehydrate an existing lead (used by the mapper). */
  static create(create: CreateEntityProps<LeadProps>): LeadEntity {
    return new LeadEntity(create);
  }

  /** Create a brand-new lead with a generated id. */
  static createNew(props: CreateLeadProps): LeadEntity {
    const lead = new LeadEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        teamId: props.teamId ?? null,
        ownerId: props.ownerId ?? null,
        name: props.name,
        email: props.email ?? null,
        value: props.value ?? 0,
        notes: props.notes ?? null,
      },
    });

    lead.addEvent(
      new LeadCreatedDomainEvent({
        aggregateId: lead.id,
        organizationId: lead.organizationId,
        teamId: lead.teamId,
        ownerId: lead.ownerId,
        reason: 'A lead was created; listeners react to it entering the pipeline',
      }),
    );

    return lead;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get teamId(): string | null {
    return this.props.teamId;
  }

  get ownerId(): string | null {
    return this.props.ownerId;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): string | null {
    return this.props.email;
  }

  get value(): number {
    return this.props.value;
  }

  get notes(): string | null {
    return this.props.notes;
  }

  /** Move the lead to another team within the same organization. */
  assignToTeam(teamId: string | null): void {
    this.props.teamId = teamId;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  /** Hand the lead to another user, or release it back to the team. */
  assignToOwner(ownerId: string | null): void {
    this.props.ownerId = ownerId;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  updateDetails(props: { name?: string; email?: string | null; notes?: string | null }): void {
    if (props.name !== undefined) this.props.name = props.name;
    if (props.email !== undefined) this.props.email = props.email;
    if (props.notes !== undefined) this.props.notes = props.notes;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  reprice(value: number): void {
    this.props.value = value;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  public validate(): void {
    if (!this.props.organizationId?.trim()) {
      throw new ArgumentNotProvidedException('A lead must belong to an organization');
    }
    if (!this.props.name?.trim()) {
      throw new ArgumentNotProvidedException('Lead name cannot be empty');
    }
    if (!Number.isInteger(this.props.value) || this.props.value < 0) {
      throw new ArgumentNotProvidedException('Lead value must be a non-negative whole number');
    }
  }
}
