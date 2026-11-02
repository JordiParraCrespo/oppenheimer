import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindPairingTokenQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly tokenId: string;

  constructor(props: { scope: AccessScope; tokenId: string }) {
    super();
    this.scope = props.scope;
    this.tokenId = props.tokenId;
  }
}
