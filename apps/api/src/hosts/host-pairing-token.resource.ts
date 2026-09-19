import { defineResource } from '@oppenheimer/backend-authz';

/**
 * The row scope of `host_pairing_token`, and nothing more.
 *
 * Deliberately **not** contributed to the authorization kernel through
 * `AuthzModule.forFeature`: the pairing routes are authorized as `Host`
 * (`create`/`read`/`delete`) because a token is how a host comes to exist, and
 * registering a second subject would put a noun in the role builder that no
 * policy, scope or screen ever names. What it is here for is
 * `applyAccessScope`: the token repository is scope-enforced like every other,
 * and this is the column mapping that drives its predicate.
 *
 * `own` is the only dimension. A token is a credential in flight — it is not
 * shareable, so there is nothing for a grant to reach.
 */
export const HostPairingTokenResource = defineResource({
  subject: 'HostPairingToken',
  label: 'Host pairing tokens',
  group: 'control-plane',
  actions: [{ name: 'read', label: 'View pairing tokens' }],
  keys: { owner: 'createdByUserId', id: 'id' },
  scopes: ['own'],
});
