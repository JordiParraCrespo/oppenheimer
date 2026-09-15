import { defineResource } from '@oppenheimer/backend-authz';

export const BillingResource = defineResource({
  subject: 'Billing',
  label: 'Billing',
  group: 'platform',
  actions: [
    { name: 'read', label: 'View subscription and invoices' },
    { name: 'manage', label: 'Change plan and payment method', sensitive: true },
  ],
  keys: {},
  scopes: [],
  credentialScope: 'billing',
});
