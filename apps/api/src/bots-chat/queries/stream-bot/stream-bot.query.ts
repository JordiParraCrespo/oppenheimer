import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class StreamBotQuery extends QueryBase {
  constructor(
    readonly scope: AccessScope,
    readonly botId: string,
  ) {
    super();
  }
}
