import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindModelProviderCredentialsQuery extends QueryBase {
  constructor(readonly scope: AccessScope) {
    super();
  }
}
