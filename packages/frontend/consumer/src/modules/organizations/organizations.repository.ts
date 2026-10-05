import {
  heyApiSdk,
  type OrganizationResponseDto,
  type UpdateOrganizationRequest,
} from '@oppenheimer/api-client';
import { MapApiError, unwrapBody } from '@oppenheimer/frontend-core';
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
 * The personal workspace, and only that (`product/versions/mvp/08-auth.md`).
 * The API still serves the starter's members and invitations endpoints; the
 * console does not call them, so they have no repository method or hook — a
 * roster is the teams slice's to add.
 */
@injectable()
export class OrganizationsRepository {
  @MapApiError(OrganizationsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<OrganizationEntity[]> {
    const result = await unwrapBody(
      heyApiSdk.listOrganizations(),
      OrganizationsErrors.FETCH_LIST_FAILED,
    );
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
    const result = await unwrapBody(
      heyApiSdk.createOrganization({ body: dto }),
      OrganizationsErrors.CREATE_FAILED,
    );
    return toEntity(result);
  }

  /**
   * Is this address free? Asked while the reader types it on the onboarding
   * step, so the answer is a plain boolean rather than an entity.
   *
   * A failed read throws rather than reporting "taken": the onboarding step
   * gates Continue on availability, and a network blip that answered `false`
   * would tell somebody an address they can have is already gone.
   */
  @MapApiError(OrganizationsErrors.CHECK_SLUG_FAILED)
  async checkSlug(slug: string): Promise<boolean> {
    const result = await unwrapBody(
      heyApiSdk.checkSlug({ body: { slug } }),
      OrganizationsErrors.CHECK_SLUG_FAILED,
    );
    return result.available;
  }

  @MapApiError(OrganizationsErrors.UPDATE_FAILED)
  async update(id: string, changes: UpdateOrganizationRequest): Promise<OrganizationEntity> {
    const result = await unwrapBody(
      heyApiSdk.updateOrganization({ path: { id }, body: changes }),
      OrganizationsErrors.UPDATE_FAILED,
    );
    return toEntity(result);
  }
}
