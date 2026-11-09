import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** The folders under a host's home whose name holds `text`, found by its runner. */
export class SearchHostFoldersQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly hostId: string;
  readonly text: string;

  constructor(props: { scope: AccessScope; hostId: string; text: string }) {
    super();
    this.scope = props.scope;
    this.hostId = props.hostId;
    this.text = props.text;
  }
}
