import { requireOrganization, requireTenant } from '../application/tenant-scope.policy';
import { emptyScope } from '../domain/access-scope.types';

/**
 * The one tenancy check every tenant use case makes: a scope with an
 * organization passes through unchanged, and one without is refused with the
 * shared code, never a module's own.
 */
describe('requireTenant', () => {
  it('lets a scope that names an organization through', () => {
    expect(() => requireTenant(emptyScope('user-1', 'org-1'))).not.toThrow();
  });

  it('refuses a scope with no organization with TENANT_001, a 400', () => {
    expect(() => requireTenant(emptyScope('user-1'))).toThrow(
      expect.objectContaining({ code: 'TENANT_001', status: 400 }),
    );
  });
});

describe('requireOrganization', () => {
  it('lets an organization id through', () => {
    expect(() => requireOrganization('org-1')).not.toThrow();
  });

  it.each([null, undefined, ''])('refuses %j with TENANT_001', (organizationId) => {
    expect(() => requireOrganization(organizationId)).toThrow(
      expect.objectContaining({ code: 'TENANT_001' }),
    );
  });
});
