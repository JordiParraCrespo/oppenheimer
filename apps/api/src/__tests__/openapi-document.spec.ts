import { describe, expect, it } from 'vitest';
import { operationIdFor } from '../openapi-document';

/**
 * An operation's name is the generated client's function name, so it is
 * decided by one rule rather than by a decorator on each route.
 */
describe('operationIdFor', () => {
  it('names a slice by its use case, whatever its method is called', () => {
    expect(operationIdFor('FindHostsHttpController', 'list')).toBe('findHosts');
    expect(operationIdFor('MintPairingTokenHttpController', 'mint')).toBe('mintPairingToken');
  });

  it('names a route of a controller that holds several by its method', () => {
    expect(operationIdFor('OrganizationsController', 'listOrganizations')).toBe(
      'listOrganizations',
    );
  });
});
