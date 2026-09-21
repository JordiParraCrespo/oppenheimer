import type { UpdateOrganizationRequest } from '@oppenheimer/api-client';
import type { CreateOrganizationDto } from '@oppenheimer/shared';
import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { OrganizationEntity } from './organization.entity';
import type { OrganizationsRepository } from './organizations.repository';

/**
 * Whether a slug is still the one sign-up minted rather than one a person
 * chose. The provisioning hook derives it from the account and appends eight
 * hex characters to keep it unique
 * (`apps/api/src/organizations/domain/personal-workspace.entity.ts`), so that
 * suffix is what marks an address nobody has claimed yet.
 */
export function isProvisionalSlug(slug: string): boolean {
  return /-[0-9a-f]{8}$/.test(slug);
}

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
   * Claim the personal workspace: give it the name and address its owner chose.
   *
   * This is onboarding step 2's whole job, and it belongs here rather than in
   * the screen because it encodes a decision from
   * `product/versions/mvp/08-auth.md`: sign-up provisions exactly one
   * workspace, so the step **names** that row. Creating is the recovery path
   * for the account whose sign-up hook did not run — not a second branch the
   * happy path can fall into.
   *
   * The caller passes the workspace it read. Deciding here from a list would
   * put the same list-order guess one layer down; a screen that has not
   * finished reading passes `undefined` and must not submit yet.
   *
   * The address is set once. `08` and `05` both call it permanent, so a claim
   * over a workspace that already has a slug sends only the name — re-slugging
   * on a revisit would move an address the reader was told would not move, and
   * `check-slug` counts their own slug as taken anyway.
   */
  async claimPersonalWorkspace({
    existing,
    name,
    slug,
  }: {
    /** The workspace sign-up provisioned, when the caller has read one. */
    existing: OrganizationEntity | undefined;
    name: string;
    slug: string;
  }): Promise<OrganizationEntity> {
    if (!existing) return this.repository.create({ name, slug });

    const claimed = !isProvisionalSlug(existing.slug);
    return this.repository.update(existing.id, claimed ? { name } : { name, slug });
  }

  /** Whether an address is still free, for the onboarding step that claims one. */
  checkSlug(slug: string): Promise<boolean> {
    return this.repository.checkSlug(slug);
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
