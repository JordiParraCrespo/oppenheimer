import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** The caller's workspace's Sentry connection; `SENTRY_002` when it has none. */
export class FindSentryConnectionQuery extends QueryBase {
  readonly scope: AccessScope;

  constructor(props: { scope: AccessScope }) {
    super();
    this.scope = props.scope;
  }
}
