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

  /**
   * Claim the personal workspace: give it the name and address its owner chose.
   *
   * It lives here, not in the screen, because it encodes a decision from
   * `product/versions/mvp/08-auth.md`: sign-up provisions exactly one workspace,
   * so onboarding step 2 **names** that row. Creating is only the recovery path
   * for an account whose sign-up hook did not run.
   *
   * The caller passes the workspace it read, so no list-order guess happens
   * here; a screen that has not finished reading passes `undefined` and must
   * not submit yet.
   *
   * The address is set once (`08` and `05` call it permanent): a workspace whose
   * slug is no longer provisional gets only the name, and `check-slug` counts
   * its own slug as taken anyway.
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

  checkSlug(slug: string): Promise<boolean> {
    return this.repository.checkSlug(slug);
  }
}
