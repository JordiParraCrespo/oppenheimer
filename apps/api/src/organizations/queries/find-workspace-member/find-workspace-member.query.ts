import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindWorkspaceMemberQuery extends QueryBase {
  readonly workspaceId: string;
  readonly userId: string;

  constructor(props: { workspaceId: string; userId: string }) {
    super();
    this.workspaceId = props.workspaceId;
    this.userId = props.userId;
  }
}
