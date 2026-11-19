import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindWorkingBotsQuery extends QueryBase {
  constructor(readonly scope: AccessScope) {
    super();
  }
}
