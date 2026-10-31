import {
  heyApiSdk,
  type OrganizationResponseDto,
  type UpdateOrganizationRequest,
} from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
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
  findAll(): Promise<OrganizationEntity[]> {
    return callApi(OrganizationsErrors.FETCH_LIST_FAILED, async (api) => {
      const result = await api.body(heyApiSdk.listOrganizations());
      return result.map(toEntity);
    });
  }

  /**
   * Create a workspace and become its owner.
   *
   * Sign-up creates the personal workspace itself; this is the recovery path
   * for an account that ended up with none. The API writes the owner
   * membership and the org-scoped role in the same call, so the creator can
   * open what they just made without a second request.
   */
  create(dto: CreateOrganizationDto): Promise<OrganizationEntity> {
    return callApi(OrganizationsErrors.CREATE_FAILED, async (api) => {
      const result = await api.body(heyApiSdk.createOrganization({ body: dto }));
      return toEntity(result);
    });
  }

  /**
   * Is this address free? Asked while the reader types it on the onboarding
   * step, so the answer is a plain boolean rather than an entity.
   *
   * A failed read throws rather than reporting "taken": the onboarding step
   * gates Continue on availability, and a network blip that answered `false`
   * would tell somebody an address they can have is already gone.
   */
  checkSlug(slug: string): Promise<boolean> {
    return callApi(OrganizationsErrors.CHECK_SLUG_FAILED, async (api) => {
      const result = await api.body(heyApiSdk.checkSlug({ body: { slug } }));
      return result.available;
    });
  }

  update(id: string, changes: UpdateOrganizationRequest): Promise<OrganizationEntity> {
    return callApi(OrganizationsErrors.UPDATE_FAILED, async (api) => {
      const result = await api.body(heyApiSdk.updateOrganization({ path: { id }, body: changes }));
      return toEntity(result);
    });
  }
}
