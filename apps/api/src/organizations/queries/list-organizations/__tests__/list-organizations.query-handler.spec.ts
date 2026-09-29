import { describe, expect, it, vi } from 'vitest';
import { ListOrganizationsQuery } from '../list-organizations.query';
import { ListOrganizationsQueryHandler } from '../list-organizations.query-handler';

const headers = { cookie: 'session=abc' };
const org = (id: string) => ({ id, name: id, slug: id }) as never;

function handlerListing(ids: string[]) {
  const organizations = { list: vi.fn().mockResolvedValue(ids.map(org)) };
  return new ListOrganizationsQueryHandler(organizations as never);
}

describe('ListOrganizationsQueryHandler', () => {
  it('keeps Better Auth’s order when the session has no selection', async () => {
    const result = await handlerListing(['org1', 'org2']).execute(
      new ListOrganizationsQuery({ headers, activeOrganizationId: null, resourceScope: null }),
    );
    expect(result.map((o) => o.id)).toEqual(['org1', 'org2']);
  });

  it('puts the session active organization first for organization-aware screens', async () => {
    const result = await handlerListing(['org1', 'org2']).execute(
      new ListOrganizationsQuery({ headers, activeOrganizationId: 'org2', resourceScope: null }),
    );
    expect(result.map((o) => o.id)).toEqual(['org2', 'org1']);
  });

  it('shows a credential pinned to one organization only that one', async () => {
    const result = await handlerListing(['org1', 'org2']).execute(
      new ListOrganizationsQuery({
        headers,
        activeOrganizationId: null,
        resourceScope: { organizationIds: ['org2'] },
      }),
    );
    expect(result.map((o) => o.id)).toEqual(['org2']);
  });
});
