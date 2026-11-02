import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/**
 * The scope is on the query because the installation is read the same way the
 * listing reads it: an installation the caller cannot see cannot have its
 * repositories listed, and that check happens before GitHub is asked anything.
 */
export class ListInstallationRepositoriesQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly installationId: string;

  constructor(props: { scope: AccessScope; installationId: string }) {
    super();
    this.scope = props.scope;
    this.installationId = props.installationId;
  }
}
