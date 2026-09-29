import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { InvitationRepositoryPort } from '../../database/invitation.repository.port';
import type { Invitation } from '../../domain/invitation.types';
import { OrganizationErrors } from '../../domain/organization.errors';
import { INVITATION_REPOSITORY } from '../../organizations.di-tokens';
import { FindInvitationQuery } from './find-invitation.query';

/**
 * An invitation as it stands, for a command to answer with. Read from the table,
 * not Better Auth, which shows an invitation only to the person it was sent to.
 */
@QueryHandler(FindInvitationQuery)
export class FindInvitationQueryHandler implements IQueryHandler<FindInvitationQuery, Invitation> {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitations: InvitationRepositoryPort,
  ) {}

  async execute(query: FindInvitationQuery): Promise<Invitation> {
    const found = await this.invitations.findOneById(query.invitationId);
    if (found.isNone()) throw new AppError(OrganizationErrors.INVITATION_NOT_FOUND);
    return found.unwrap();
  }
}
