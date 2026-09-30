import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindWorkspaceQuery extends QueryBase {
  readonly workspaceId: string;

  constructor(props: { workspaceId: string }) {
    super();
    this.workspaceId = props.workspaceId;
  }
}
