import { defineResource } from '@oppenheimer/backend-authz';

/**
 * Feature-flag targeting and segments. One write action, because every write
 * has the same blast radius — a rule change and a pulled kill switch both
 * change the product for every user at once — so both are marked sensitive.
 */
export const FeatureFlagResource = defineResource({
  subject: 'FeatureFlag',
  label: 'Feature flags',
  group: 'platform',
  actions: [
    { name: 'read', label: 'View flags, targeting and history' },
    { name: 'update', label: 'Change targeting, kill switches and segments', sensitive: true },
  ],
  keys: {},
  scopes: [],
  credentialScope: 'flags',
});
