import type { UserOrmEntity } from '../users/database/user.orm-entity';
import type { MemberOrmEntity } from './database/member.orm-entity';
import type { Membership } from './domain/membership.types';
import type { MemberResponseDto } from './dtos/organization.response.dto';

/**
 * The shapes one membership takes: Better Auth's `member` row and the account
 * behind it, the {@link Membership} read model, and the response the members
 * endpoints publish. Pure functions, as `AGENTS.md` asks of a mapper.
 */
export function toMembership(member: MemberOrmEntity, user: UserOrmEntity | null): Membership {
  return {
    id: member.id,
    organizationId: member.organizationId,
    userId: member.userId,
    role: member.role,
    createdAt: member.createdAt,
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
        }
      : null,
  };
}

export function toMembershipResponse(membership: Membership): MemberResponseDto {
  return {
    id: membership.id,
    organizationId: membership.organizationId,
    userId: membership.userId,
    role: membership.role,
    createdAt: membership.createdAt,
    user: membership.user ? { ...membership.user } : null,
  };
}
