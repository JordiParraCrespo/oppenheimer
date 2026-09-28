import type { IncomingHttpHeaders } from 'node:http';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { describeError } from '@oppenheimer/backend-core';
import { MembershipAccessPolicy } from '../../application/membership-access.policy';
import { PersonalWorkspaceProvisionedDomainEvent } from '../../domain/events/personal-workspace-provisioned.domain-event';
import { OrganizationSlug } from '../../domain/value-objects/organization-slug.value-object';
import type { OrganizationResponseDto } from '../../dtos/organization.response.dto';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import type { WorkspaceAuthPort } from '../../infrastructure/workspace-auth.port';
import { ORGANIZATION_AUTH, WORKSPACE_AUTH } from '../../organizations.di-tokens';
import { CreateOrganizationCommand } from './create-organization.command';

/** The workspace every new organization starts with, named as sign-up names it. */
const DEFAULT_WORKSPACE = 'General';

/**
 * Creates an organization, and makes it one the creator can actually open.
 *
 * Better Auth writes the organization and an `owner` membership; neither is
 * what the app's routes check. Until the org-scoped application role is
 * written the creator owns an organization they have no permission to read —
 * how a self-service registration used to land on a 403 (issue #106). So the
 * role is granted here, and if it cannot be the organization is discarded
 * rather than handed back unopenable. The default workspace and the
 * announcement that follow are best-effort: failing the request over them
 * would tell the caller an organization they own does not exist.
 */
@CommandHandler(CreateOrganizationCommand)
export class CreateOrganizationCommandHandler
  implements ICommandHandler<CreateOrganizationCommand, OrganizationResponseDto>
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

  async execute({ headers, input, creatorId }: CreateOrganizationCommand) {
    // The slug rule is the value object's, shared with the personal workspace.
    const slug = input.slug ?? OrganizationSlug.derive(input.name).value;
    const organization = await this.organizations.create(headers, { ...input, slug });
    // No authenticated caller: Better Auth's membership stands, no roles move.
    if (!creatorId) return organization;

    try {
      await this.membershipAccess.grant(creatorId, organization.id, 'owner');
    } catch (error) {
      await this.discard(headers, organization.id);
      throw error;
    }
    await this.provisionDefaultWorkspace(headers, organization.id, creatorId);
    await this.announce(organization, creatorId);
    return organization;
  }

  /** Undo an organization nobody can open. The caller still sees the original error. */
  private async discard(headers: IncomingHttpHeaders, organizationId: string): Promise<void> {
    try {
      await this.organizations.delete(headers, organizationId);
    } catch (error) {
      this.logger.error(
        {
          message: 'Could not discard an organization whose role assignment failed',
          organizationId,
        },
        error instanceof Error ? error.stack : String(error),
      );
    }
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

  /** Tell the API the workspace exists, as sign-up does, so it gets its Unassigned project. */
  private async announce(organization: OrganizationResponseDto, ownerId: string): Promise<void> {
    try {
      await this.events.emitAsync(
        PersonalWorkspaceProvisionedDomainEvent.name,
        new PersonalWorkspaceProvisionedDomainEvent({
          aggregateId: organization.id,
          ownerId,
          name: organization.name,
          slug: organization.slug,
        }),
      );
    } catch (error) {
      this.logger.error(
        { message: 'A listener failed on a new workspace', organizationId: organization.id },
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
