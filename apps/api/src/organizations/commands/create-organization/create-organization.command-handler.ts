import type { IncomingHttpHeaders } from 'node:http';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { describeError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { MembershipAccessPolicy } from '../../application/membership-access.policy';
import { OrganizationCreatedDomainEvent } from '../../domain/events/organization-created.domain-event';
import { OrganizationSlug } from '../../domain/value-objects/organization-slug.value-object';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { ORGANIZATION_AUTH, WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { CreateOrganizationCommand } from './create-organization.command';

/** The workspace (Better Auth team) an organization created here starts with. */
const DEFAULT_WORKSPACE = 'General';

/**
 * Creates an organization the creator can actually open, and answers its id.
 *
 * Better Auth writes the organization and an `owner` membership; neither is
 * what the app's routes check. `MembershipAccessPolicy.admit` grants the
 * org-scoped role beside them, and discards the organization if it cannot: an
 * organization its owner cannot read answers them 403 (issue #106). The
 * default workspace and the announcement that follow are best-effort: failing
 * the request over them would tell the caller an organization they own does
 * not exist.
 */
@CommandHandler(CreateOrganizationCommand)
export class CreateOrganizationCommandHandler
  implements ICommandHandler<CreateOrganizationCommand, AggregateID>
{
  private readonly logger = new Logger(CreateOrganizationCommandHandler.name);

  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
    @Inject(WORKSPACE_AUTH)
    private readonly workspaces: WorkspaceAuthPort,
    private readonly membershipAccess: MembershipAccessPolicy,
    private readonly events: EventEmitter2,
  ) {}

  async execute({ headers, input, creatorId }: CreateOrganizationCommand): Promise<AggregateID> {
    const slug = input.slug ?? OrganizationSlug.derive(input.name).value;
    const create = () => this.organizations.create(headers, { ...input, slug });
    // No authenticated caller: Better Auth's membership stands, no roles move.
    if (!creatorId) return (await create()).id;

    const { organizationId } = await this.membershipAccess.admit(
      async () => ({ userId: creatorId, organizationId: (await create()).id, role: 'owner' }),
      (entry) => this.organizations.delete(headers, entry.organizationId),
    );
    await this.provisionDefaultWorkspace(headers, organizationId, creatorId);
    await this.announce(organizationId, creatorId);
    return organizationId;
  }

  private async provisionDefaultWorkspace(
    headers: IncomingHttpHeaders,
    organizationId: string,
    creatorId: string,
  ): Promise<void> {
    try {
      const workspace = await this.workspaces.create(headers, {
        name: DEFAULT_WORKSPACE,
        organizationId,
      });
      await this.workspaces.addMember(headers, workspace.id, creatorId);
      await this.workspaces.setActive(headers, workspace.id);
    } catch (error) {
      this.logger.warn({
        message: 'Could not provision the default workspace for a new organization',
        organizationId,
        reason: describeError(error),
      });
    }
  }

  /** Announce the organization in process, so it gets its Unassigned project. */
  private async announce(organizationId: string, creatorId: string): Promise<void> {
    try {
      await this.events.emitAsync(
        OrganizationCreatedDomainEvent.name,
        new OrganizationCreatedDomainEvent({ aggregateId: organizationId, creatorId }),
      );
    } catch (error) {
      this.logger.error(
        { message: 'A listener failed on a new organization', organizationId },
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
