import {
  type OrganizationResponseDto,
  OrganizationsApi,
  type UpdateOrganizationRequest,
} from '@oppenheimer/api-client';
import { AppError, MapApiError } from '@oppenheimer/frontend-core';
import type { CreateOrganizationDto } from '@oppenheimer/shared';
import { injectable } from 'inversify';
import { OrganizationEntity } from './organization.entity';
import { OrganizationsErrors } from './organizations.errors';

function toEntity(organization: OrganizationResponseDto): OrganizationEntity {
  return new OrganizationEntity(
    organization.id,
    organization.name,
    organization.slug,
    organization.logo ?? null,
    new Date(organization.createdAt),
  );
}

/**
 * The personal workspace, and only that. The API still serves the starter's
 * members and invitations endpoints; the console does not call them, so they
 * have no repository method here — a roster is the teams slice's to add.
 */
@injectable()
export class OrganizationsRepository {
  @MapApiError(OrganizationsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<OrganizationEntity[]> {
    const result = await OrganizationsApi.list();
    // An absent body is a failed read, not an empty collection — returning `[]`
    // here would render "no workspace" over a request that never succeeded.
    if (!result) throw new AppError(OrganizationsErrors.FETCH_LIST_FAILED);

    return result.map(toEntity);
  }

  /**
   * Create a workspace and become its owner.
   *
   * Sign-up creates the personal workspace itself; this is the recovery path
   * for an account that ended up with none. The API writes the owner
   * membership and the org-scoped role in the same call, so the creator can
   * open what they just made without a second request.
   */
  @MapApiError(OrganizationsErrors.CREATE_FAILED)
  async create(dto: CreateOrganizationDto): Promise<OrganizationEntity> {
    const result = await OrganizationsApi.create(dto);
    if (!result) throw new AppError(OrganizationsErrors.CREATE_FAILED);
    return toEntity(result);
  }

  @MapApiError(OrganizationsErrors.UPDATE_FAILED)
  async update(id: string, changes: UpdateOrganizationRequest): Promise<OrganizationEntity> {
    const result = await OrganizationsApi.update(id, changes);
    if (!result) throw new AppError(OrganizationsErrors.UPDATE_FAILED);

    return toEntity(result);
  }
}
