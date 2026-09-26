import type { AccessScope } from '@oppenheimer/backend-authz';
import type { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessGrantRepositoryPort } from '../../../database/access-grant.repository.port';
import type { AccessGrantEntity } from '../../../domain/access-grant.entity';
import { FindAccessGrantQuery } from '../find-access-grant.query';
import { FindAccessGrantQueryHandler } from '../find-access-grant.query-handler';

const GRANT = { id: 'grant-1' } as AccessGrantEntity;
const SCOPE = { organizationId: 'org-1' } as AccessScope;

describe('FindAccessGrantQueryHandler', () => {
  let repo: Pick<AccessGrantRepositoryPort, 'findOneInOrganization'>;
  let handler: FindAccessGrantQueryHandler;

  beforeEach(() => {
    repo = { findOneInOrganization: vi.fn().mockResolvedValue(Some(GRANT)) };
    handler = new FindAccessGrantQueryHandler(repo as AccessGrantRepositoryPort);
  });

  it('reads the grant by id inside the active organization', async () => {
    await expect(
      handler.execute(new FindAccessGrantQuery({ scope: SCOPE, grantId: 'grant-1' })),
    ).resolves.toBe(GRANT);
    expect(repo.findOneInOrganization).toHaveBeenCalledWith('org-1', 'grant-1');
  });

  it('reports a missing grant as GRANT_001 rather than returning another one', async () => {
    // The create route used to list every grant and fall back to the first
    // when the new id was not among them, answering with someone else's grant.
    repo.findOneInOrganization = vi.fn().mockResolvedValue(None);

    const error = await handler
      .execute(new FindAccessGrantQuery({ scope: SCOPE, grantId: 'ghost' }))
      .catch((e) => e as AppError);

    expect((error as AppError).code).toBe('GRANT_001');
  });

  it('refuses without an active organization', async () => {
    const error = await handler
      .execute(new FindAccessGrantQuery({ scope: {} as AccessScope, grantId: 'grant-1' }))
      .catch((e) => e as AppError);

    expect((error as AppError).code).toBe('GRANT_004');
    expect(repo.findOneInOrganization).not.toHaveBeenCalled();
  });
});
