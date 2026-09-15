import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppError } from '@oppenheimer/backend-core';
import type { Repository } from 'typeorm';
import { MemberOrmEntity } from '../../organizations/database/member.orm-entity';
import { AuthzErrors } from '../domain/authz.errors';

/** Header a client uses to act in an organization other than the session's. */
export const ACTIVE_ORGANIZATION_HEADER = 'x-active-organization';

/**
 * Resolves which organization a request acts in.
 *
 * The session's `activeOrganizationId` is the default. A client may override it
 * per request with the `X-Active-Organization` header — useful for a tab acting
 * in a different organization than the one the session last switched to, and
 * for API clients that hold no session state.
 *
 * The override is **validated against the caller's memberships**. A header the
 * server trusts blindly is a tenant-isolation hole: it would let any
 * authenticated user read another organization's data simply by naming it.
 */
@Injectable()
export class ActiveOrganizationResolver {
  constructor(
    @InjectRepository(MemberOrmEntity)
    private readonly members: Repository<MemberOrmEntity>,
  ) {}

  async resolve(input: {
    userId: string | undefined;
    sessionOrganizationId: string | null | undefined;
    header: string | undefined;
  }): Promise<string | null> {
    const requested = input.header?.trim();
    if (!requested) return input.sessionOrganizationId ?? null;

    // Asking for the organization the session already carries needs no lookup:
    // Better Auth only sets it after checking membership.
    if (requested === input.sessionOrganizationId) return requested;

    if (!input.userId) {
      throw new AppError(AuthzErrors.ACTIVE_ORGANIZATION_NOT_A_MEMBERSHIP);
    }

    const membership = await this.members.findOne({
      where: { userId: input.userId, organizationId: requested },
      select: { id: true },
    });

    if (!membership) {
      throw new AppError(AuthzErrors.ACTIVE_ORGANIZATION_NOT_A_MEMBERSHIP, {
        detail: `You are not a member of organization ${requested}`,
        extensions: { organizationId: requested },
      });
    }

    return requested;
  }
}
