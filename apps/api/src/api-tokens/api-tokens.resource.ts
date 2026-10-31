import { defineResource } from '../authz/domain/resource-definition.types';

export const ApiTokenResource = defineResource({
  subject: 'ApiToken',
  label: 'API tokens',
  group: 'platform',
  actions: [
    { name: 'read', label: 'View tokens' },
    { name: 'create', label: 'Mint tokens', sensitive: true },
    { name: 'delete', label: 'Revoke tokens' },
  ],
  keys: { owner: 'userId' },
  scopes: ['own'],
  credentialScope: 'tokens',
});
