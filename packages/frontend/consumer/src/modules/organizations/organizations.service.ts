import type { UpdateOrganizationRequest } from '@oppenheimer/api-client';
import type { CreateOrganizationDto } from '@oppenheimer/shared';
import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { OrganizationEntity } from './organization.entity';
import type { OrganizationsRepository } from './organizations.repository';

@injectable()
export class OrganizationsService {
  constructor(
    @inject(TOKENS.OrganizationsRepository)
    private readonly repository: OrganizationsRepository,
  ) {}

  findAll(): Promise<OrganizationEntity[]> {
    return this.repository.findAll();
  }

  /** Create a workspace and become its owner — the recovery path for an account that has none. */
  create(dto: CreateOrganizationDto): Promise<OrganizationEntity> {
    return this.repository.create(dto);
  }

  /**
   * Rename the workspace or change its mark.
   *
   * Name, slug and logo live on the organization record rather than in
   * organization *settings* — the split mirrors the server's, so the client
   * cannot develop its own idea of where they belong.
   */
  update(id: string, changes: UpdateOrganizationRequest): Promise<OrganizationEntity> {
    return this.repository.update(id, changes);
  }
}
