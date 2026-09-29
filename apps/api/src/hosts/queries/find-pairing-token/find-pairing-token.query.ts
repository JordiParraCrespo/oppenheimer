import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindPairingTokenQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly tokenId: string;

  constructor(props: { scope: AccessScope; tokenId: string }) {
    super();
    this.scope = props.scope;
    this.tokenId = props.tokenId;
  }
}
